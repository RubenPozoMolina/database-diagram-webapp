/**
 * Integration tests for the DDL generator against a real PostgreSQL instance.
 *
 * These tests generate DDL from a diagram model, apply it to a throwaway
 * PostgreSQL container, and introspect the resulting schema to verify that
 * tables, columns, primary keys, foreign keys, unique constraints and
 * indexes were all created correctly. This is the round-trip acceptance
 * criterion for TASK-043: model -> DDL -> empty database -> equivalent schema.
 *
 * Connection parameters are read from environment variables:
 *   PG_HOST, PG_PORT, PG_DATABASE, PG_USER, PG_PASSWORD
 *
 * The tests are skipped when no PostgreSQL connection parameters are
 * provided (for example when running `npm test` without a database).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "pg";
import { generateDDL, type Diagram } from "../services/ddl-generator";

function env(name: string): string | undefined {
  return process.env[name];
}

const PG_AVAILABLE = Boolean(env("PG_HOST") && env("PG_DATABASE") && env("PG_USER") && env("PG_PASSWORD"));

const pgIt = PG_AVAILABLE ? it : it.skip;
const pgDescribe = PG_AVAILABLE ? describe : describe.skip;

const VALID = {
  host: env("PG_HOST") ?? "localhost",
  port: env("PG_PORT") ? Number(env("PG_PORT")) : 5432,
  database: env("PG_DATABASE") ?? "postgres",
  user: env("PG_USER") ?? "postgres",
  password: env("PG_PASSWORD") ?? "",
};

function buildDiagram(): Diagram {
  return {
    id: "dia-integration",
    name: "Integration Diagram",
    tables: [
      {
        id: "tbl-department",
        name: "department",
        columns: [
          { id: "c-d-id", name: "department_id", type: "integer", length: null, nullable: false, primaryKey: true, unique: false, defaultValue: null },
          { id: "c-d-name", name: "name", type: "text", length: null, nullable: false, primaryKey: false, unique: false, defaultValue: null },
          { id: "c-d-head", name: "head_employee_id", type: "integer", length: null, nullable: true, primaryKey: false, unique: false, defaultValue: null },
          { id: "c-d-active", name: "is_active", type: "boolean", length: null, nullable: false, primaryKey: false, unique: false, defaultValue: "TRUE" },
        ],
      },
      {
        id: "tbl-employee",
        name: "employee",
        columns: [
          { id: "c-e-id", name: "employee_id", type: "integer", length: null, nullable: false, primaryKey: true, unique: false, defaultValue: null },
          { id: "c-e-name", name: "name", type: "text", length: null, nullable: false, primaryKey: false, unique: false, defaultValue: null },
          { id: "c-e-dept", name: "department_id", type: "integer", length: null, nullable: false, primaryKey: false, unique: false, defaultValue: null },
          { id: "c-e-manager", name: "manager_id", type: "integer", length: null, nullable: true, primaryKey: false, unique: false, defaultValue: null },
          { id: "c-e-hired", name: "hire_date", type: "timestamp", length: null, nullable: false, primaryKey: false, unique: false, defaultValue: null },
          { id: "c-e-salary", name: "salary", type: "numeric", length: null, nullable: true, primaryKey: false, unique: false, defaultValue: null },
          { id: "c-e-uuid", name: "employee_uuid", type: "uuid", length: null, nullable: true, primaryKey: false, unique: false, defaultValue: null },
        ],
      },
      {
        id: "tbl-project",
        name: "project",
        columns: [
          { id: "c-p-id", name: "project_id", type: "integer", length: null, nullable: false, primaryKey: true, unique: false, defaultValue: null },
          { id: "c-p-code", name: "code", type: "text", length: null, nullable: false, primaryKey: false, unique: false, defaultValue: null },
          { id: "c-p-name", name: "name", type: "text", length: null, nullable: false, primaryKey: false, unique: false, defaultValue: null },
        ],
      },
      {
        id: "tbl-employee_project",
        name: "employee_project",
        columns: [
          { id: "c-ep-eid", name: "employee_id", type: "integer", length: null, nullable: false, primaryKey: true, unique: false, defaultValue: null },
          { id: "c-ep-pid", name: "project_id", type: "integer", length: null, nullable: false, primaryKey: true, unique: false, defaultValue: null },
          { id: "c-ep-role", name: "role", type: "text", length: null, nullable: false, primaryKey: false, unique: false, defaultValue: null },
        ],
      },
    ],
    relationships: [
      {
        id: "rel-e-dept",
        sourceTableId: "tbl-employee",
        sourceColumnId: "c-e-dept",
        targetTableId: "tbl-department",
        targetColumnId: "c-d-id",
        onDelete: "restrict",
        onUpdate: "cascade",
      },
      {
        id: "rel-e-manager",
        sourceTableId: "tbl-employee",
        sourceColumnId: "c-e-manager",
        targetTableId: "tbl-employee",
        targetColumnId: "c-e-id",
        onDelete: "set null",
        onUpdate: "cascade",
      },
      {
        id: "rel-d-head",
        sourceTableId: "tbl-department",
        sourceColumnId: "c-d-head",
        targetTableId: "tbl-employee",
        targetColumnId: "c-e-id",
        onDelete: "set null",
        onUpdate: "cascade",
      },
      {
        id: "rel-ep-e",
        sourceTableId: "tbl-employee_project",
        sourceColumnId: "c-ep-eid",
        targetTableId: "tbl-employee",
        targetColumnId: "c-e-id",
        onDelete: "cascade",
        onUpdate: "cascade",
      },
      {
        id: "rel-ep-p",
        sourceTableId: "tbl-employee_project",
        sourceColumnId: "c-ep-pid",
        targetTableId: "tbl-project",
        targetColumnId: "c-p-id",
        onDelete: "cascade",
        onUpdate: "cascade",
      },
    ],
    uniqueConstraints: [
      { id: "uc-p-code", tableId: "tbl-project", columnIds: ["c-p-code"], name: "project_code_unique" },
      { id: "uc-ep", tableId: "tbl-employee_project", columnIds: ["c-ep-eid", "c-ep-pid"], name: null },
    ],
    indexes: [
      { id: "idx-e-dept", tableId: "tbl-employee", columnIds: ["c-e-dept"], unique: false, name: "idx_employee_department" },
      { id: "idx-e-manager", tableId: "tbl-employee", columnIds: ["c-e-manager"], unique: false, name: "idx_employee_manager" },
      { id: "idx-p-name", tableId: "tbl-project", columnIds: ["c-p-name"], unique: false, name: "idx_project_name" },
    ],
  };
}

async function applyDDL(client: Client, ddl: string): Promise<void> {
  const statements = ddl.split(";").map((s) => s.trim()).filter((s) => s.length > 0);
  for (const stmt of statements) {
    await client.query(stmt);
  }
}

/**
 * Drops every table in the public schema so the integration tests start
 * from a clean, empty database. Required because each test file runs against
 * the same throwaway container and our generated DDL uses plain CREATE TABLE
 * (no IF NOT EXISTS).
 */
async function dropAllPublicTables(client: Client): Promise<void> {
  await client.query(
    `DO $$ DECLARE r RECORD;
     BEGIN
       FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
         EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
       END LOOP;
     END $$;`
  );
}

async function introspect(client: Client) {
  const tables = await client.query(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
     ORDER BY table_name`
  );

  const result: Record<string, any> = {};
  for (const row of tables.rows) {
    const tableName = row.table_name;

    const cols = await client.query(
      `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1
       ORDER BY ordinal_position`,
      [tableName]
    );

    const pks = await client.query(
      `SELECT kcu.column_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema AND tc.table_name = kcu.table_name
       WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public' AND tc.table_name = $1
       ORDER BY kcu.ordinal_position`,
      [tableName]
    );

    const fks = await client.query(
      `SELECT kcu.column_name, ccu.table_name AS foreign_table, ccu.column_name AS foreign_column
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema AND tc.table_name = kcu.table_name
       JOIN information_schema.constraint_column_usage ccu
         ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
       WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public' AND tc.table_name = $1
       ORDER BY kcu.ordinal_position`,
      [tableName]
    );

    const uks = await client.query(
      `SELECT tc.constraint_name, kcu.column_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema AND tc.table_name = kcu.table_name
       WHERE tc.constraint_type = 'UNIQUE' AND tc.table_schema = 'public' AND tc.table_name = $1
       ORDER BY tc.constraint_name, kcu.ordinal_position`,
      [tableName]
    );

    const idxs = await client.query(
      `SELECT ic.relname AS index_name, a.attname AS column_name
       FROM pg_index i
       JOIN pg_class c ON c.oid = i.indrelid
       JOIN pg_namespace ns ON ns.oid = c.relnamespace
       JOIN pg_class ic ON ic.oid = i.indexrelid
       JOIN generate_subscripts(i.indkey, 1) AS g(s) ON true
       JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = i.indkey[g.s]
       WHERE ns.nspname = 'public' AND c.relname = $1 AND i.indisprimary = false AND i.indisunique = false
       ORDER BY ic.relname, g.s`,
      [tableName]
    );

    result[tableName] = {
      columns: cols.rows.map((r: any) => r.column_name),
      primaryKeys: pks.rows.map((r: any) => r.column_name),
      foreignKeys: fks.rows.map((r: any) => ({
        column: r.column_name,
        foreignTable: r.foreign_table,
        foreignColumn: r.foreign_column,
      })),
      uniqueConstraints: uks.rows.map((r: any) => ({
        constraint: r.constraint_name,
        column: r.column_name,
      })),
      indexes: idxs.rows.map((r: any) => ({
        index: r.index_name,
        column: r.column_name,
      })),
    };
  }
  return result;
}

pgDescribe("DDL generator integration (real PostgreSQL)", () => {
  let client: Client;
  let ddl: string;

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

    await dropAllPublicTables(client);

    ddl = generateDDL(buildDiagram());
    expect(ddl.length).toBeGreaterThan(0);
    await applyDDL(client, ddl);
  });

  afterAll(async () => {
    await client.end().catch(() => {
      // Ignore errors during cleanup.
    });
  });

  pgIt("applies CREATE TABLE statements successfully", async () => {
    const schema = await introspect(client);
    expect(schema).toHaveProperty("department");
    expect(schema).toHaveProperty("employee");
    expect(schema).toHaveProperty("project");
    expect(schema).toHaveProperty("employee_project");
  });

  pgIt("creates columns with correct types and nullability", async () => {
    const schema = await introspect(client);
    expect(schema.department.columns).toContain("department_id");
    // department.department_id INTEGER NOT NULL
    const deptCols = await client.query(
      `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns
       WHERE table_schema='public' AND table_name='department' ORDER BY ordinal_position`
    );
    const idCol = deptCols.rows.find((r: any) => r.column_name === "department_id");
    expect(idCol.data_type).toBe("integer");
    expect(idCol.is_nullable).toBe("NO");

    // department.is_active BOOLEAN NOT NULL DEFAULT TRUE
    const activeCol = deptCols.rows.find((r: any) => r.column_name === "is_active");
    expect(activeCol.data_type).toBe("boolean");
    expect(activeCol.is_nullable).toBe("NO");
    expect(activeCol.column_default).toBe("true");

    // employee.hire_date TIMESTAMP NOT NULL
    const empCols = await client.query(
      `SELECT column_name, data_type, is_nullable FROM information_schema.columns
       WHERE table_schema='public' AND table_name='employee'`
    );
    const hireCol = empCols.rows.find((r: any) => r.column_name === "hire_date");
    expect(hireCol.data_type).toBe("timestamp without time zone");

    const uuidCol = empCols.rows.find((r: any) => r.column_name === "employee_uuid");
    expect(uuidCol.data_type).toBe("uuid");
    expect(uuidCol.is_nullable).toBe("YES");
  });

  pgIt("creates primary key constraints (single and composite)", async () => {
    const schema = await introspect(client);
    expect(schema.department.primaryKeys).toEqual(["department_id"]);
    expect(schema.employee.primaryKeys).toEqual(["employee_id"]);
    expect(schema.project.primaryKeys).toEqual(["project_id"]);
    // Composite primary key on employee_project.
    expect(schema.employee_project.primaryKeys).toEqual(["employee_id", "project_id"]);
  });

  pgIt("creates foreign key constraints (including self-referencing and circular)", async () => {
    const schema = await introspect(client);

    // employee.department_id -> department.department_id
    const empDeptFK = schema.employee.foreignKeys.find(
      (fk: any) => fk.column === "department_id" && fk.foreignTable === "department"
    );
    expect(empDeptFK).toBeDefined();
    expect(empDeptFK.foreignColumn).toBe("department_id");

    // Self-referencing: employee.manager_id -> employee.employee_id
    const empMgrFK = schema.employee.foreignKeys.find(
      (fk: any) => fk.column === "manager_id" && fk.foreignTable === "employee"
    );
    expect(empMgrFK).toBeDefined();
    expect(empMgrFK.foreignColumn).toBe("employee_id");

    // Circular: department.head_employee_id -> employee.employee_id
    const deptHeadFK = schema.department.foreignKeys.find(
      (fk: any) => fk.column === "head_employee_id" && fk.foreignTable === "employee"
    );
    expect(deptHeadFK).toBeDefined();
    expect(deptHeadFK.foreignColumn).toBe("employee_id");

    // Junction table FKs.
    expect(schema.employee_project.foreignKeys).toHaveLength(2);
  });

  pgIt("creates unique constraints", async () => {
    const schema = await introspect(client);

    // project.code unique constraint (named project_code_unique).
    const projUKs = schema.project.uniqueConstraints.filter((uc: any) => uc.constraint === "project_code_unique");
    expect(projUKs.length).toBe(1);
    expect(projUKs[0].column).toBe("code");

    // Composite unique constraint on employee_project (employee_id, project_id).
    const epUKs = schema.employee_project.uniqueConstraints;
    const epCols = new Set(epUKs.map((uc: any) => uc.column));
    expect(epCols.has("employee_id")).toBe(true);
    expect(epCols.has("project_id")).toBe(true);
  });

  pgIt("creates indexes", async () => {
    const schema = await introspect(client);

    // employee.department_id has a plain index idx_employee_department.
    const deptIdx = schema.employee.indexes.find(
      (i: any) => i.index === "idx_employee_department"
    );
    expect(deptIdx).toBeDefined();
    expect(deptIdx.column).toBe("department_id");

    // project.name has a plain index idx_project_name.
    const nameIdx = schema.project.indexes.find((i: any) => i.index === "idx_project_name");
    expect(nameIdx).toBeDefined();
    expect(nameIdx.column).toBe("name");

    // Indexes that are backed by constraints (PK/unique) are filtered out
    // by i.indisprimary = false AND i.indisunique = false, so they should
    // not appear here.
    const projectPkIndex = schema.project.indexes.find((i: any) => i.index === "project_pkey");
    expect(projectPkIndex).toBeUndefined();
  });

  pgIt("generated DDL contains no destructive statements", async () => {
    const upper = ddl.toUpperCase();
    expect(upper).not.toContain("DROP");
    expect(upper).not.toContain("TRUNCATE");
    // "ON DELETE <action>" is a referential action, not a destructive
    // DELETE statement, so check per-statement that none starts with DELETE.
    const statements = upper.split(";").map((s) => s.trim()).filter((s) => s.length > 0);
    expect(statements.some((s) => /^DELETE\b/.test(s))).toBe(false);
  });
});
