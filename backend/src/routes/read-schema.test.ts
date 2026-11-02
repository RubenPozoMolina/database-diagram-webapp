/**
 * HTTP route tests for POST /api/read-schema.
 *
 * The IntrospectionService is mocked so these tests run without a live
 * PostgreSQL server. pg.Client is also mocked since the route creates a
 * real client. Each case verifies the response shape matches the read-schema
 * API specification (docs/api/read-schema.md), including tables, columns,
 * data types, primary keys, foreign keys, unique constraints and indexes,
 * plus error handling and password redaction.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { app } from "../app";

vi.mock("pg", () => {
  const connectMock = vi.fn().mockResolvedValue(undefined);
  const endMock = vi.fn().mockResolvedValue(undefined);
  const queryMock = vi.fn();
  const clientMock = vi.fn().mockImplementation(() => ({
    connect: connectMock,
    end: endMock,
    query: queryMock,
  }));
  return {
    Client: clientMock,
    clientMock,
    connectMock,
    endMock,
    queryMock,
  };
});

declare module "pg" {
  export const clientMock: ReturnType<typeof vi.fn>;
  export const connectMock: ReturnType<typeof vi.fn>;
  export const endMock: ReturnType<typeof vi.fn>;
  export const queryMock: ReturnType<typeof vi.fn>;
}
import { clientMock, connectMock, endMock, queryMock } from "pg";

vi.mock("../services/introspection.service", () => ({
  IntrospectionService: vi.fn().mockImplementation(() => ({
    introspectSchema: vi.fn(),
  })),
  IntrospectionError: class IntrospectionError extends Error {
    readonly statusCode: number;
    constructor(statusCode: number, message: string) {
      super(message);
      this.name = "IntrospectionError";
      this.statusCode = statusCode;
    }
  },
}));

import { IntrospectionService } from "../services/introspection.service";

// The route module creates `const introspectionService = new IntrospectionService()`
// at load time. Grab that instance so we can control its introspectSchema mock.
const serviceInstance = vi.mocked(IntrospectionService).mock.results[0]
  ?.value as { introspectSchema: ReturnType<typeof vi.fn> } | undefined;

const mockIntrospectSchema = serviceInstance?.introspectSchema ?? vi.fn();

const schema = "public";

const basePayload = {
  host: "localhost",
  port: 5432,
  database: "mydb",
  user: "app_user",
  password: "s3cr3t",
  schema,
};

beforeEach(() => {
  vi.clearAllMocks();
  clientMock.mockImplementation(() => ({
    connect: connectMock,
    end: endMock,
    query: queryMock,
  }));
  connectMock.mockResolvedValue(undefined);
  endMock.mockResolvedValue(undefined);
  queryMock.mockResolvedValue({ rows: [] });
  mockIntrospectSchema.mockResolvedValue({ tables: [] });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/read-schema", () => {
  it("returns 200 with tables, columns and data types", async () => {
    mockIntrospectSchema.mockResolvedValue({
      tables: [
        {
          name: "employee",
          columns: [
            { table_name: "employee", column_name: "employee_id", column_position: 1, is_nullable: "NO", column_default: null, data_type: "integer", character_maximum_length: null, numeric_precision: 32, numeric_scale: 0, datetime_precision: null, interval_type: null },
            { table_name: "employee", column_name: "name", column_position: 2, is_nullable: "NO", column_default: null, data_type: "text", character_maximum_length: null, numeric_precision: null, numeric_scale: null, datetime_precision: null, interval_type: null },
          ],
          primaryKeys: [
            { table_name: "employee", constraint_name: "employee_pkey", column_name: "employee_id", column_position: 1 },
          ],
          foreignKeys: [],
          uniqueConstraints: [],
          indexes: [],
        },
      ],
    });

    const res = await request(app)
      .post("/api/read-schema")
      .send(basePayload)
      .expect("Content-Type", /json/)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.schema).toBe("public");
    expect(res.body.tables).toHaveLength(1);
    expect(res.body.tables[0].name).toBe("employee");
    expect(res.body.tables[0].columns).toHaveLength(2);
    expect(res.body.tables[0].columns[0]).toMatchObject({
      name: "employee_id",
      dataType: "integer",
      isNullable: false,
      numericPrecision: 32,
      numericScale: 0,
    });
    expect(res.body.tables[0].columns[1]).toMatchObject({
      name: "name",
      dataType: "text",
      isNullable: false,
    });
    expect(res.body.tables[0].primaryKeys).toHaveLength(1);
    expect(res.body.tables[0].primaryKeys[0]).toMatchObject({
      constraintName: "employee_pkey",
      columns: ["employee_id"],
    });
  });

  it("returns 200 with composite primary key grouped into one constraint", async () => {
    mockIntrospectSchema.mockResolvedValue({
      tables: [
        {
          name: "employee_project",
          columns: [
            { table_name: "employee_project", column_name: "employee_id", column_position: 1, is_nullable: "NO", column_default: null, data_type: "integer", character_maximum_length: null, numeric_precision: 32, numeric_scale: 0, datetime_precision: null, interval_type: null },
            { table_name: "employee_project", column_name: "project_id", column_position: 2, is_nullable: "NO", column_default: null, data_type: "integer", character_maximum_length: null, numeric_precision: 32, numeric_scale: 0, datetime_precision: null, interval_type: null },
          ],
          primaryKeys: [
            { table_name: "employee_project", constraint_name: "employee_project_pkey", column_name: "employee_id", column_position: 1 },
            { table_name: "employee_project", constraint_name: "employee_project_pkey", column_name: "project_id", column_position: 2 },
          ],
          foreignKeys: [],
          uniqueConstraints: [],
          indexes: [],
        },
      ],
    });

    const res = await request(app)
      .post("/api/read-schema")
      .send(basePayload)
      .expect(200);

    expect(res.body.tables[0].primaryKeys).toHaveLength(1);
    expect(res.body.tables[0].primaryKeys[0]).toMatchObject({
      constraintName: "employee_project_pkey",
      columns: ["employee_id", "project_id"],
    });
  });

  it("returns 200 with foreign keys including self-referencing and circular", async () => {
    mockIntrospectSchema.mockResolvedValue({
      tables: [
        {
          name: "employee",
          columns: [],
          primaryKeys: [],
          foreignKeys: [
            { table_name: "employee", constraint_name: "employee_manager_fk", column_name: "manager_id", column_position: 1, foreign_table_name: "employee", foreign_column_name: "employee_id", update_rule: "CASCADE", delete_rule: "SET NULL" },
          ],
          uniqueConstraints: [],
          indexes: [],
        },
        {
          name: "department",
          columns: [],
          primaryKeys: [],
          foreignKeys: [
            { table_name: "department", constraint_name: "department_head_fk", column_name: "head_employee_id", column_position: 1, foreign_table_name: "employee", foreign_column_name: "employee_id", update_rule: "CASCADE", delete_rule: "SET NULL" },
          ],
          uniqueConstraints: [],
          indexes: [],
        },
      ],
    });

    const res = await request(app)
      .post("/api/read-schema")
      .send(basePayload)
      .expect(200);

    const employeeTable = res.body.tables.find((t: any) => t.name === "employee");
    expect(employeeTable.foreignKeys).toHaveLength(1);
    expect(employeeTable.foreignKeys[0]).toMatchObject({
      constraintName: "employee_manager_fk",
      column: "manager_id",
      foreignTable: "employee",
      foreignColumn: "employee_id",
      updateRule: "CASCADE",
      deleteRule: "SET NULL",
    });

    const departmentTable = res.body.tables.find((t: any) => t.name === "department");
    expect(departmentTable.foreignKeys).toHaveLength(1);
    expect(departmentTable.foreignKeys[0]).toMatchObject({
      constraintName: "department_head_fk",
      column: "head_employee_id",
      foreignTable: "employee",
      foreignColumn: "employee_id",
    });
  });

  it("returns 200 with unique constraints and indexes", async () => {
    mockIntrospectSchema.mockResolvedValue({
      tables: [
        {
          name: "project",
          columns: [],
          primaryKeys: [],
          foreignKeys: [],
          uniqueConstraints: [
            { table_name: "project", constraint_name: "project_code_unique", column_name: "code", column_position: 1 },
          ],
          indexes: [
            { table_name: "project", index_name: "idx_project_name", column_name: "name", column_position: 1, is_unique: false, is_primary: false, is_valid: true, index_type: "btree", index_definition: "CREATE INDEX idx_project_name ON public.project USING btree (name)" },
          ],
        },
      ],
    });

    const res = await request(app)
      .post("/api/read-schema")
      .send(basePayload)
      .expect(200);

    expect(res.body.tables[0].uniqueConstraints).toHaveLength(1);
    expect(res.body.tables[0].uniqueConstraints[0]).toMatchObject({
      constraintName: "project_code_unique",
      columns: ["code"],
    });
    expect(res.body.tables[0].indexes).toHaveLength(1);
    expect(res.body.tables[0].indexes[0]).toMatchObject({
      name: "idx_project_name",
      columns: ["name"],
      isUnique: false,
      isPrimary: false,
      isValid: true,
      indexType: "btree",
      definition: "CREATE INDEX idx_project_name ON public.project USING btree (name)",
    });
  });

  it("returns 400 when a required field is missing", async () => {
    const { password: _unused, ...withoutPassword } = basePayload;
    void _unused;

    const res = await request(app)
      .post("/api/read-schema")
      .send(withoutPassword)
      .expect(400);

    expect(res.body.success).toBe(false);
    const passwordIssue = res.body.issues?.find((i: any) => i.path.includes("password"));
    expect(passwordIssue).toBeDefined();
    expect(mockIntrospectSchema).not.toHaveBeenCalled();
  });

  it("returns 400 when the body is not a JSON object", async () => {
    const res = await request(app)
      .post("/api/read-schema")
      .send("not json")
      .set("Content-Type", "application/json")
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(mockIntrospectSchema).not.toHaveBeenCalled();
  });

  it("returns 401 for authentication failure without leaking the password", async () => {
    const { IntrospectionError } = await import("../services/introspection.service");
    const err = new IntrospectionError(401, 'Authentication failed: password authentication failed for user "app_user".');
    mockIntrospectSchema.mockRejectedValue(err);

    const res = await request(app)
      .post("/api/read-schema")
      .send({ ...basePayload, password: "wrong" })
      .expect(401);

    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain("Authentication failed");
    expect(JSON.stringify(res.body)).not.toContain("wrong");
    expect(JSON.stringify(res.body)).not.toContain("s3cr3t");
  });

  it("returns 502 for connection refused", async () => {
    const { IntrospectionError } = await import("../services/introspection.service");
    const err = new IntrospectionError(502, "Unable to reach PostgreSQL server: connection refused.");
    mockIntrospectSchema.mockRejectedValue(err);

    const res = await request(app)
      .post("/api/read-schema")
      .send(basePayload)
      .expect(502);

    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain("Unable to reach PostgreSQL server");
  });

  it("returns 504 for introspection timeout", async () => {
    const { IntrospectionError } = await import("../services/introspection.service");
    const err = new IntrospectionError(504, "Schema introspection timed out after 30 seconds.");
    mockIntrospectSchema.mockRejectedValue(err);

    const res = await request(app)
      .post("/api/read-schema")
      .send(basePayload)
      .expect(504);

    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain("timed out");
  });

  it("returns 500 for unexpected errors without leaking internals", async () => {
    mockIntrospectSchema.mockRejectedValue(new Error("boom"));

    const res = await request(app)
      .post("/api/read-schema")
      .send(basePayload)
      .expect(500);

    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe("Internal server error while introspecting the schema.");
    expect(JSON.stringify(res.body)).not.toContain("boom");
  });

  it("never includes the password in the response body", async () => {
    const { IntrospectionError } = await import("../services/introspection.service");
    const err = new IntrospectionError(401, 'Authentication failed: password authentication failed for user "app_user".');
    mockIntrospectSchema.mockRejectedValue(err);

    const res = await request(app)
      .post("/api/read-schema")
      .send({ ...basePayload, password: "super-secret-password-123" })
      .expect(401);

    const body = JSON.stringify(res.body);
    expect(body).not.toContain("super-secret-password-123");
  });

  it("returns an empty tables list for an empty schema", async () => {
    mockIntrospectSchema.mockResolvedValue({ tables: [] });

    const res = await request(app)
      .post("/api/read-schema")
      .send(basePayload)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.tables).toEqual([]);
  });
});
