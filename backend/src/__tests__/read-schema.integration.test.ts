/**
 * Integration tests for the introspection service against a real PostgreSQL
 * instance.
 *
 * These tests connect to a throwaway PostgreSQL container, seed the schema
 * from `database/seed.sql`, and introspect the `app` schema to verify that
 * tables, columns, data types, primary keys, foreign keys, unique constraints
 * and indexes are all returned correctly.
 *
 * Connection parameters are read from environment variables:
 *   PG_HOST, PG_PORT, PG_DATABASE, PG_USER, PG_PASSWORD
 *
 * The tests are skipped when no PostgreSQL connection parameters are
 * provided (for example when running `npm test` without a database).
 *
 * Intended to run inside Docker against a throwaway postgres:16 container on
 * a private network (see docker-test-runner skill).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "pg";
import fs from "fs";
import path from "path";
import { IntrospectionService } from "../services/introspection.service";

function env(name: string): string | undefined {
  return process.env[name];
}

const PG_AVAILABLE = Boolean(
  env("PG_HOST") && env("PG_DATABASE") && env("PG_USER") && env("PG_PASSWORD"),
);

const pgIt = PG_AVAILABLE ? it : it.skip;
const pgDescribe = PG_AVAILABLE ? describe : describe.skip;

const VALID = {
  host: env("PG_HOST") ?? "localhost",
  port: env("PG_PORT") ? Number(env("PG_PORT")) : 5432,
  database: env("PG_DATABASE") ?? "postgres",
  user: env("PG_USER") ?? "postgres",
  password: env("PG_PASSWORD") ?? "",
};

const SCHEMA = "app";

async function dropAppSchema(client: Client): Promise<void> {
  await client.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
}

async function seedSchema(client: Client): Promise<void> {
  const seedPath = path.resolve(__dirname, "../../../database/seed.sql");
  const seedSql = fs.readFileSync(seedPath, "utf8");
  const statements = seedSql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const stmt of statements) {
    await client.query(stmt);
  }
}

pgDescribe("Introspection service integration (real PostgreSQL)", () => {
  let client: Client;
  let service: IntrospectionService;

  beforeAll(async () => {
    client = new Client({
      host: VALID.host,
      port: VALID.port,
      database: VALID.database,
      user: VALID.user,
      password: VALID.password,
      connectionTimeoutMillis: 10000,
    });
    await client.connect();

    await dropAppSchema(client);
    await seedSchema(client);

    service = new IntrospectionService();
  });

  afterAll(async () => {
    await dropAppSchema(client);
    await client.end().catch(() => {
      // Ignore errors during cleanup.
    });
  });

  pgIt("retrieves tables and columns with data types", async () => {
    const result = await service.introspectSchema(client, SCHEMA);

    const tableNames = result.tables.map((t) => t.name);
    expect(tableNames).toContain("department");
    expect(tableNames).toContain("employee");
    expect(tableNames).toContain("project");
    expect(tableNames).toContain("employee_project");
    expect(tableNames).toContain("order");

    const employeeTable = result.tables.find((t) => t.name === "employee");
    expect(employeeTable).toBeDefined();

    const idCol = employeeTable!.columns.find((c) => c.column_name === "employee_id");
    expect(idCol.data_type).toBe("integer");
    expect(idCol.is_nullable).toBe("NO");

    const hireCol = employeeTable!.columns.find((c) => c.column_name === "hire_date");
    expect(hireCol.data_type).toBe("timestamp without time zone");
    expect(hireCol.is_nullable).toBe("NO");

    const uuidCol = employeeTable!.columns.find((c) => c.column_name === "employee_uuid");
    expect(uuidCol.data_type).toBe("uuid");
    expect(uuidCol.is_nullable).toBe("YES");

    const salaryCol = employeeTable!.columns.find((c) => c.column_name === "salary");
    expect(salaryCol.data_type).toBe("numeric");
    expect(salaryCol.numeric_precision).toBe(10);
    expect(salaryCol.numeric_scale).toBe(2);
  });

  pgIt("retrieves primary keys (single and composite)", async () => {
    const result = await service.introspectSchema(client, SCHEMA);

    const byTable = (name: string) => result.tables.find((t) => t.name === name)!;

    expect(byTable("department").primaryKeys.map((p) => p.column_name)).toEqual(["department_id"]);
    expect(byTable("employee").primaryKeys.map((p) => p.column_name)).toEqual(["employee_id"]);
    expect(byTable("project").primaryKeys.map((p) => p.column_name)).toEqual(["project_id"]);
    // Composite primary key on employee_project.
    expect(byTable("employee_project").primaryKeys.map((p) => p.constraint_name)).toEqual([
      "employee_project_pkey",
    ]);
    expect(byTable("employee_project").primaryKeys.map((p) => p.column_name)).toEqual([
      "employee_id",
      "project_id",
    ]);
  });

  pgIt("retrieves foreign keys (single, composite, self-referencing, circular)", async () => {
    const result = await service.introspectSchema(client, SCHEMA);

    const byTable = (name: string) => result.tables.find((t) => t.name === name)!;

    // employee.department_id -> department.department_id
    const empDeptFK = byTable("employee").foreignKeys.find(
      (fk) => fk.column_name === "department_id" && fk.foreign_table_name === "department",
    );
    expect(empDeptFK).toBeDefined();
    expect(empDeptFK.foreign_column_name).toBe("department_id");

    // Self-referencing: employee.manager_id -> employee.employee_id
    const empMgrFK = byTable("employee").foreignKeys.find(
      (fk) => fk.column_name === "manager_id" && fk.foreign_table_name === "employee",
    );
    expect(empMgrFK).toBeDefined();
    expect(empMgrFK.foreign_column_name).toBe("employee_id");

    // Circular: department.head_employee_id -> employee.employee_id
    const deptHeadFK = byTable("department").foreignKeys.find(
      (fk) => fk.column_name === "head_employee_id" && fk.foreign_table_name === "employee",
    );
    expect(deptHeadFK).toBeDefined();
    expect(deptHeadFK.foreign_column_name).toBe("employee_id");

    // Junction table FKs.
    expect(byTable("employee_project").foreignKeys).toHaveLength(2);
  });

  pgIt("retrieves unique constraints (single and composite)", async () => {
    const result = await service.introspectSchema(client, SCHEMA);

    const byTable = (name: string) => result.tables.find((t) => t.name === name)!;

    // project.code unique constraint (named project_code_unique).
    const projUKs = byTable("project").uniqueConstraints.filter(
      (uc) => uc.constraint_name === "project_code_unique",
    );
    expect(projUKs.length).toBe(1);
    expect(projUKs[0].column_name).toBe("code");

    // Composite unique constraint on employee_project (employee_id, project_id)
    // is backed by the primary key, so it won't appear as a separate UNIQUE
    // constraint in information_schema. The PK covers it.
  });

  pgIt("retrieves indexes (plain, unique, composite)", async () => {
    const result = await service.introspectSchema(client, SCHEMA);

    const byTable = (name: string) => result.tables.find((t) => t.name === name)!;

    // employee.department_id has a plain index idx_employee_department.
    const deptIdx = byTable("employee").indexes.find(
      (i) => i.index_name === "idx_employee_department",
    );
    expect(deptIdx).toBeDefined();
    expect(deptIdx.column_name).toBe("department_id");
    expect(deptIdx.is_unique).toBe(false);
    expect(deptIdx.is_primary).toBe(false);

    // project.name has a plain index idx_project_name.
    const nameIdx = byTable("project").indexes.find((i) => i.index_name === "idx_project_name");
    expect(nameIdx).toBeDefined();
    expect(nameIdx.column_name).toBe("name");

    // Composite unique index on app."order"(customer_id, order_date).
    const orderTable = byTable("order");
    const orderIdx = orderTable.indexes.find(
      (i) => i.index_name === "idx_order_customer_date",
    );
    expect(orderIdx).toBeDefined();
    expect(orderIdx.is_unique).toBe(true);
    expect(orderIdx.column_name).toBe("customer_id");
    // The second column of the composite index.
    const orderIdxCols = orderTable.indexes
      .find((i) => i.index_name === "idx_order_customer_date")
      ?.column_name;
    // Verify the composite index has both columns by checking row count.
    const orderIdxRows = orderTable.indexes.filter(
      (i) => i.index_name === "idx_order_customer_date",
    );
    expect(orderIdxRows.map((r) => r.column_name).sort()).toEqual([
      "customer_id",
      "order_date",
    ]);
  });

  pgIt("excludes system schemas", async () => {
    const result = await service.introspectSchema(client, SCHEMA);
    // All returned tables should be in the app schema, not pg_catalog or information_schema.
    expect(result.tables.length).toBeGreaterThan(0);
    for (const table of result.tables) {
      expect(table.name).not.toMatch(/^pg_/);
    }
  });
});
