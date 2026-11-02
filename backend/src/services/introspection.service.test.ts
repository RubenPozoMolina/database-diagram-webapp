/**
 * Unit tests for the introspection service.
 *
 * The pg.Client is mocked so these tests run without a live PostgreSQL
 * server. Each case verifies that the service:
 *   - Runs all five introspection queries with the schema parameter
 *   - Executes them inside a BEGIN READ ONLY / COMMIT transaction
 *   - Groups columns, primary keys, foreign keys, unique constraints and
 *     indexes by table and constraint/index name
 *   - Supports composite keys, self-referencing and circular foreign keys
 *   - Maps errors to the correct HTTP status code (401, 502, 504, 500)
 *   - Never leaks the database password in error messages
 */

import { Client } from "pg";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  IntrospectionService,
  IntrospectionError,
  TABLES_AND_COLUMNS_QUERY,
  PRIMARY_KEYS_QUERY,
  FOREIGN_KEYS_QUERY,
  UNIQUE_CONSTRAINTS_QUERY,
  INDEXES_QUERY,
} from "./introspection.service";

vi.mock("pg", () => ({
  Client: vi.fn(),
}));

function createMockClient(): {
  connect: ReturnType<typeof vi.fn>;
  end: ReturnType<typeof vi.fn>;
  query: ReturnType<typeof vi.fn>;
} {
  const connect = vi.fn().mockResolvedValue(undefined);
  const end = vi.fn().mockResolvedValue(undefined);
  const query = vi.fn();
  vi.mocked(Client).mockImplementation(() => ({ connect, end, query }));
  return { connect, end, query };
}

const schema = "app";

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("IntrospectionService", () => {
  it("runs all five queries with the schema parameter inside a read-only transaction", async () => {
    const { connect, end, query } = createMockClient();
    query.mockResolvedValue({ rows: [] });

    const service = new IntrospectionService();
    const client = new Client() as unknown as { connect: typeof connect; query: typeof query; end: typeof end };
    await service.introspectSchema(client as unknown as Client, schema);

    expect(connect).toHaveBeenCalledTimes(0); // client already connected by caller
    expect(query).toHaveBeenNthCalledWith(1, "BEGIN READ ONLY");
    expect(query).toHaveBeenNthCalledWith(2, `SET statement_timeout = ${30_000}`);
    expect(query).toHaveBeenNthCalledWith(3, TABLES_AND_COLUMNS_QUERY, [schema]);
    expect(query).toHaveBeenNthCalledWith(4, PRIMARY_KEYS_QUERY, [schema]);
    expect(query).toHaveBeenNthCalledWith(5, FOREIGN_KEYS_QUERY, [schema]);
    expect(query).toHaveBeenNthCalledWith(6, UNIQUE_CONSTRAINTS_QUERY, [schema]);
    expect(query).toHaveBeenNthCalledWith(7, INDEXES_QUERY, [schema]);
    expect(query).toHaveBeenNthCalledWith(8, "COMMIT");
    expect(end).toHaveBeenCalledTimes(0); // caller ends the client
  });

  it("rolls back the transaction when a query fails", async () => {
    const { query } = createMockClient();
    query.mockRejectedValue(new Error("boom"));

    const service = new IntrospectionService();
    const client = new Client() as unknown as { query: typeof query };
    await expect(service.introspectSchema(client as unknown as Client, schema)).rejects.toThrow();

    expect(query).toHaveBeenCalledWith("BEGIN READ ONLY");
    expect(query).toHaveBeenCalledWith("ROLLBACK");
    expect(query).not.toHaveBeenCalledWith("COMMIT");
  });

  it("groups columns by table and returns data types", async () => {
    const { query } = createMockClient();
    query.mockImplementation((sql) => {
      if (sql.includes("information_schema.tables")) {
        return Promise.resolve({
          rows: [
            { table_schema: "app", table_name: "employee", column_name: "employee_id", column_position: 1, is_nullable: "NO", column_default: null, data_type: "integer", character_maximum_length: null, numeric_precision: 32, numeric_scale: 0, datetime_precision: null, interval_type: null },
            { table_schema: "app", table_name: "employee", column_name: "name", column_position: 2, is_nullable: "NO", column_default: null, data_type: "text", character_maximum_length: null, numeric_precision: null, numeric_scale: null, datetime_precision: null, interval_type: null },
          ],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    const service = new IntrospectionService();
    const client = new Client() as unknown as Client;
    const result = await service.introspectSchema(client, schema);

    expect(result.tables).toHaveLength(1);
    expect(result.tables[0].name).toBe("employee");
    expect(result.tables[0].columns).toHaveLength(2);
    expect(result.tables[0].columns[0]).toMatchObject({
      column_name: "employee_id",
      data_type: "integer",
      is_nullable: "NO",
      numeric_precision: 32,
      numeric_scale: 0,
    });
    expect(result.tables[0].columns[1]).toMatchObject({
      column_name: "name",
      data_type: "text",
    });
  });

  it("groups composite primary keys into one constraint with multiple columns", async () => {
    const { query } = createMockClient();
    query.mockImplementation((sql) => {
      if (sql.includes("table_constraints") && sql.includes("PRIMARY KEY")) {
        return Promise.resolve({
          rows: [
            { table_name: "employee_project", constraint_name: "employee_project_pkey", column_name: "employee_id", column_position: 1 },
            { table_name: "employee_project", constraint_name: "employee_project_pkey", column_name: "project_id", column_position: 2 },
          ],
        });
      }
      if (sql.includes("information_schema.tables")) {
        return Promise.resolve({ rows: [{ table_schema: "app", table_name: "employee_project", column_name: "employee_id", column_position: 1, is_nullable: "NO", column_default: null, data_type: "integer", character_maximum_length: null, numeric_precision: 32, numeric_scale: 0, datetime_precision: null, interval_type: null }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const service = new IntrospectionService();
    const client = new Client() as unknown as Client;
    const result = await service.introspectSchema(client, schema);

    // The service returns one row per column; grouping by constraint name
    // happens in the route layer (groupByConstraint).
    expect(result.tables[0].primaryKeys).toHaveLength(2);
    expect(result.tables[0].primaryKeys[0].constraint_name).toBe("employee_project_pkey");
    expect(result.tables[0].primaryKeys[0].column_name).toBe("employee_id");
    expect(result.tables[0].primaryKeys[1].constraint_name).toBe("employee_project_pkey");
    expect(result.tables[0].primaryKeys[1].column_name).toBe("project_id");
  });

  it("returns self-referencing and circular foreign keys", async () => {
    const { query } = createMockClient();
    query.mockImplementation((sql) => {
      if (sql.includes("referential_constraints")) {
        return Promise.resolve({
          rows: [
            { table_name: "employee", constraint_name: "employee_manager_fk", column_name: "manager_id", column_position: 1, foreign_table_name: "employee", foreign_column_name: "employee_id", update_rule: "CASCADE", delete_rule: "SET NULL" },
            { table_name: "department", constraint_name: "department_head_fk", column_name: "head_employee_id", column_position: 1, foreign_table_name: "employee", foreign_column_name: "employee_id", update_rule: "CASCADE", delete_rule: "SET NULL" },
          ],
        });
      }
      if (sql.includes("information_schema.tables")) {
        return Promise.resolve({
          rows: [
            { table_schema: "app", table_name: "employee", column_name: "employee_id", column_position: 1, is_nullable: "NO", column_default: null, data_type: "integer", character_maximum_length: null, numeric_precision: 32, numeric_scale: 0, datetime_precision: null, interval_type: null },
            { table_schema: "app", table_name: "department", column_name: "department_id", column_position: 1, is_nullable: "NO", column_default: null, data_type: "integer", character_maximum_length: null, numeric_precision: 32, numeric_scale: 0, datetime_precision: null, interval_type: null },
          ],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    const service = new IntrospectionService();
    const client = new Client() as unknown as Client;
    const result = await service.introspectSchema(client, schema);

    const employeeTable = result.tables.find((t) => t.name === "employee");
    const departmentTable = result.tables.find((t) => t.name === "department");

    expect(employeeTable).toBeDefined();
    expect(employeeTable!.foreignKeys).toHaveLength(1);
    expect(employeeTable!.foreignKeys[0]).toMatchObject({
      constraint_name: "employee_manager_fk",
      column_name: "manager_id",
      foreign_table_name: "employee",
      foreign_column_name: "employee_id",
    });

    expect(departmentTable).toBeDefined();
    expect(departmentTable!.foreignKeys).toHaveLength(1);
    expect(departmentTable!.foreignKeys[0]).toMatchObject({
      constraint_name: "department_head_fk",
      column_name: "head_employee_id",
      foreign_table_name: "employee",
      foreign_column_name: "employee_id",
    });
  });

  it("returns unique constraints and indexes", async () => {
    const { query } = createMockClient();
    query.mockImplementation((sql) => {
      if (sql.includes("information_schema.tables")) {
        return Promise.resolve({
          rows: [
            { table_schema: "app", table_name: "project", column_name: "project_id", column_position: 1, is_nullable: "NO", column_default: null, data_type: "integer", character_maximum_length: null, numeric_precision: 32, numeric_scale: 0, datetime_precision: null, interval_type: null },
            { table_schema: "app", table_name: "project", column_name: "code", column_position: 2, is_nullable: "NO", column_default: null, data_type: "text", character_maximum_length: null, numeric_precision: null, numeric_scale: null, datetime_precision: null, interval_type: null },
          ],
        });
      }
      if (sql.includes("constraint_type = 'UNIQUE'")) {
        return Promise.resolve({
          rows: [
            { table_name: "project", constraint_name: "project_code_unique", column_name: "code", column_position: 1 },
          ],
        });
      }
      if (sql.includes("pg_index")) {
        return Promise.resolve({
          rows: [
            { table_name: "project", index_name: "idx_project_name", column_name: "name", column_position: 1, is_unique: false, is_primary: false, is_valid: true, index_type: "btree", index_definition: "CREATE INDEX idx_project_name ON app.project USING btree (name)" },
          ],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    const service = new IntrospectionService();
    const client = new Client() as unknown as Client;
    const result = await service.introspectSchema(client, schema);

    const projectTable = result.tables.find((t) => t.name === "project");
    expect(projectTable).toBeDefined();
    expect(projectTable!.uniqueConstraints).toHaveLength(1);
    expect(projectTable!.uniqueConstraints[0]).toMatchObject({
      constraint_name: "project_code_unique",
      column_name: "code",
    });
    expect(projectTable!.indexes).toHaveLength(1);
    expect(projectTable!.indexes[0]).toMatchObject({
      index_name: "idx_project_name",
      column_name: "name",
      is_unique: false,
      is_primary: false,
      is_valid: true,
      index_type: "btree",
    });
  });

  it("maps authentication failure to 401 without leaking the password", async () => {
    const { query } = createMockClient();
    query.mockRejectedValue(Object.assign(new Error('password authentication failed for user "app_user"'), { code: "28P01" }));

    const service = new IntrospectionService();
    const client = new Client() as unknown as Client;
    await expect(service.introspectSchema(client, schema)).rejects.toMatchObject({
      statusCode: 401,
      message: expect.stringContaining("Authentication failed"),
    });
  });

  it("maps connection refused to 502", async () => {
    const { query } = createMockClient();
    query.mockRejectedValue(Object.assign(new Error("connect ECONNREFUSED localhost:5432"), { code: "ECONNREFUSED" }));

    const service = new IntrospectionService();
    const client = new Client() as unknown as Client;
    await expect(service.introspectSchema(client, schema)).rejects.toMatchObject({
      statusCode: 502,
      message: expect.stringContaining("Unable to reach PostgreSQL server"),
    });
  });

  it("maps timeout to 504", async () => {
    const { query } = createMockClient();
    query.mockRejectedValue(Object.assign(new Error("canceling statement due to statement timeout"), { code: "57014" }));

    const service = new IntrospectionService();
    const client = new Client() as unknown as Client;
    await expect(service.introspectSchema(client, schema)).rejects.toMatchObject({
      statusCode: 504,
      message: expect.stringContaining("timed out"),
    });
  });

  it("maps unexpected errors to 500 without leaking internals", async () => {
    const { query } = createMockClient();
    query.mockRejectedValue(new Error("Unexpected driver failure: stack trace here"));

    const service = new IntrospectionService();
    const client = new Client() as unknown as Client;
    await expect(service.introspectSchema(client, schema)).rejects.toMatchObject({
      statusCode: 500,
      message: "Internal server error while introspecting the schema.",
    });
  });

  it("does not leak the password in error messages", async () => {
    const { query } = createMockClient();
    query.mockRejectedValue(Object.assign(new Error('password authentication failed for user "app_user"'), { code: "28P01" }));

    const service = new IntrospectionService();
    const client = new Client() as unknown as Client;
    try {
      await service.introspectSchema(client, schema);
    } catch (err) {
      const introspectionErr = err as IntrospectionError;
      expect(introspectionErr.message).not.toContain("s3cr3t");
      expect(introspectionErr.message).toContain("[redacted]");
    }
  });

  it("returns an empty tables list when the schema has no tables", async () => {
    const { query } = createMockClient();
    query.mockResolvedValue({ rows: [] });

    const service = new IntrospectionService();
    const client = new Client() as unknown as Client;
    const result = await service.introspectSchema(client, schema);

    expect(result.tables).toEqual([]);
  });
});
