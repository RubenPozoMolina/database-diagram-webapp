import { describe, it, expect } from "vitest";
import {
  generateDDL,
  type Column,
  type Diagram,
  type Index,
  type Relationship,
  type Table,
  type UniqueConstraint,
} from "./ddl-generator";

function column(overrides: Partial<Column> = {}): Column {
  return {
    id: "col-1",
    name: "id",
    type: "integer",
    length: null,
    nullable: false,
    primaryKey: false,
    unique: false,
    defaultValue: null,
    ...overrides,
  };
}

function table(overrides: Partial<Table> = {}): Table {
  return {
    id: "tbl-1",
    name: "employee",
    columns: [column()],
    ...overrides,
  };
}

function relationship(overrides: Partial<Relationship> = {}): Relationship {
  return {
    id: "rel-1",
    sourceTableId: "tbl-employee",
    sourceColumnId: "col-dept",
    targetTableId: "tbl-department",
    targetColumnId: "col-id",
    onDelete: "restrict",
    onUpdate: "cascade",
    ...overrides,
  };
}

function uniqueConstraint(overrides: Partial<UniqueConstraint> = {}): UniqueConstraint {
  return {
    id: "uc-1",
    tableId: "tbl-1",
    columnIds: ["col-1"],
    name: null,
    ...overrides,
  };
}

function index(overrides: Partial<Index> = {}): Index {
  return {
    id: "idx-1",
    tableId: "tbl-1",
    columnIds: ["col-1"],
    unique: false,
    name: null,
    ...overrides,
  };
}

function diagram(overrides: Partial<Diagram> = {}): Diagram {
  return {
    id: "dia-1",
    name: "Test Diagram",
    tables: [],
    relationships: [],
    uniqueConstraints: [],
    indexes: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Helpers to build a realistic sample diagram
// ---------------------------------------------------------------------------

function sampleDiagram(): Diagram {
  const employee = table({
    id: "tbl-employee",
    name: "employee",
    columns: [
      column({ id: "c-emp-id", name: "employee_id", type: "integer", nullable: false, primaryKey: true }),
      column({ id: "c-emp-name", name: "name", type: "text", nullable: false }),
      column({ id: "c-emp-dept", name: "department_id", type: "integer", nullable: false }),
      column({ id: "c-emp-manager", name: "manager_id", type: "integer", nullable: true }),
      column({ id: "c-emp-hired", name: "hire_date", type: "timestamp", nullable: false }),
      column({ id: "c-emp-salary", name: "salary", type: "numeric", nullable: true }),
      column({ id: "c-emp-uuid", name: "employee_uuid", type: "uuid", nullable: true }),
    ],
  });
  const department = table({
    id: "tbl-department",
    name: "department",
    columns: [
      column({ id: "c-dept-id", name: "department_id", type: "integer", nullable: false, primaryKey: true }),
      column({ id: "c-dept-name", name: "name", type: "text", nullable: false }),
      column({ id: "c-dept-head", name: "head_employee_id", type: "integer", nullable: true }),
      column({ id: "c-dept-active", name: "is_active", type: "boolean", nullable: false, defaultValue: "TRUE" }),
    ],
  });
  const project = table({
    id: "tbl-project",
    name: "project",
    columns: [
      column({ id: "c-proj-id", name: "project_id", type: "integer", nullable: false, primaryKey: true }),
      column({ id: "c-proj-code", name: "code", type: "text", nullable: false, unique: true }),
      column({ id: "c-proj-name", name: "name", type: "text", nullable: false }),
    ],
  });

  return diagram({
    tables: [employee, department, project],
    relationships: [
      relationship({
        id: "rel-emp-dept",
        sourceTableId: "tbl-employee",
        sourceColumnId: "c-emp-dept",
        targetTableId: "tbl-department",
        targetColumnId: "c-dept-id",
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
      relationship({
        id: "rel-emp-manager",
        sourceTableId: "tbl-employee",
        sourceColumnId: "c-emp-manager",
        targetTableId: "tbl-employee",
        targetColumnId: "c-emp-id",
        onDelete: "set null",
        onUpdate: "cascade",
      }),
    ],
    uniqueConstraints: [
      uniqueConstraint({
        id: "uc-proj-code",
        tableId: "tbl-project",
        columnIds: ["c-proj-code"],
        name: "project_code_unique",
      }),
    ],
    indexes: [
      index({
        id: "idx-emp-dept",
        tableId: "tbl-employee",
        columnIds: ["c-emp-dept"],
        unique: false,
        name: "idx_employee_department",
      }),
    ],
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("generateDDL", () => {
  it("produces CREATE TABLE statements for every table", () => {
    const ddl = generateDDL(
      diagram({ tables: [table({ name: "employee" }), table({ name: "department" })] })
    );
    expect(ddl).toContain('CREATE TABLE "employee" (');
    expect(ddl).toContain('CREATE TABLE "department" (');
    expect(ddl.split("CREATE TABLE").length - 1).toBe(2);
  });

  it("renders column name, type and nullability", () => {
    const ddl = generateDDL(
      diagram({
        tables: [
          table({
            name: "employee",
            columns: [
              column({ name: "employee_id", type: "integer", nullable: false }),
              column({ name: "name", type: "text", nullable: false }),
              column({ name: "nickname", type: "text", nullable: true }),
            ],
          }),
        ],
      })
    );
    expect(ddl).toContain('"employee_id" INTEGER NOT NULL');
    expect(ddl).toContain('"name" TEXT NOT NULL');
    expect(ddl).toContain('"nickname" TEXT');
    // nullable columns must NOT have NOT NULL.
    expect(ddl).not.toContain('"nickname" TEXT NOT NULL');
  });

  it("renders column defaults", () => {
    const ddl = generateDDL(
      diagram({
        tables: [
          table({
            name: "department",
            columns: [
              column({ name: "is_active", type: "boolean", nullable: false, defaultValue: "TRUE" }),
              column({ name: "code", type: "varchar", length: 10, nullable: true, defaultValue: "N/A" }),
            ],
          }),
        ],
      })
    );
    expect(ddl).toContain('"is_active" BOOLEAN NOT NULL DEFAULT TRUE');
    expect(ddl).toContain("DEFAULT 'N/A'");
  });

  it("maps all supported column types to PostgreSQL", () => {
    const ddl = generateDDL(
      diagram({
        tables: [
          table({
            name: "types",
            columns: [
              column({ name: "c_int", type: "integer" }),
              column({ name: "c_bigint", type: "bigint" }),
              column({ name: "c_serial", type: "serial" }),
              column({ name: "c_bigserial", type: "bigserial" }),
              column({ name: "c_text", type: "text" }),
              column({ name: "c_varchar", type: "varchar", length: 255 }),
              column({ name: "c_bool", type: "boolean" }),
              column({ name: "c_date", type: "date" }),
              column({ name: "c_ts", type: "timestamp" }),
              column({ name: "c_numeric", type: "numeric" }),
              column({ name: "c_uuid", type: "uuid" }),
              column({ name: "c_jsonb", type: "jsonb" }),
            ],
          }),
        ],
      })
    );
    expect(ddl).toContain('"c_int" INTEGER');
    expect(ddl).toContain('"c_bigint" BIGINT');
    expect(ddl).toContain('"c_serial" SERIAL');
    expect(ddl).toContain('"c_bigserial" BIGSERIAL');
    expect(ddl).toContain('"c_text" TEXT');
    expect(ddl).toContain('"c_varchar" VARCHAR(255)');
    expect(ddl).toContain('"c_bool" BOOLEAN');
    expect(ddl).toContain('"c_date" DATE');
    expect(ddl).toContain('"c_ts" TIMESTAMP');
    expect(ddl).toContain('"c_numeric" NUMERIC');
    expect(ddl).toContain('"c_uuid" UUID');
    expect(ddl).toContain('"c_jsonb" JSONB');
  });

  it("produces an inline PRIMARY KEY constraint for a single-column key", () => {
    const ddl = generateDDL(
      diagram({
        tables: [
          table({
            name: "employee",
            columns: [column({ name: "employee_id", type: "integer", nullable: false, primaryKey: true })],
          }),
        ],
      })
    );
    expect(ddl).toContain('"employee_id" INTEGER NOT NULL PRIMARY KEY');
  });

  it("produces a separate PRIMARY KEY constraint for a composite key", () => {
    const ddl = generateDDL(
      diagram({
        tables: [
          table({
            name: "employee_project",
            columns: [
              column({ name: "employee_id", type: "integer", nullable: false, primaryKey: true }),
              column({ name: "project_id", type: "integer", nullable: false, primaryKey: true }),
              column({ name: "role", type: "text", nullable: false }),
            ],
          }),
        ],
      })
    );
    // Composite PK columns must NOT carry an inline PRIMARY KEY.
    expect(ddl).not.toMatch(/"employee_id" INTEGER NOT NULL PRIMARY KEY/);
    expect(ddl).not.toMatch(/"project_id" INTEGER NOT NULL PRIMARY KEY/);
    // Table-level composite constraint is added after table creation.
    expect(ddl).toContain(
      'ALTER TABLE "employee_project" ADD CONSTRAINT "pk_employee_project" PRIMARY KEY ("employee_id", "project_id")'
    );
  });

  it("produces FOREIGN KEY constraints from relationships", () => {
    const ddl = generateDDL(sampleDiagram());
    expect(ddl).toContain(
      'ALTER TABLE "employee" ADD CONSTRAINT "fk_employee_department_id" FOREIGN KEY ("department_id") REFERENCES "department"("department_id") ON DELETE RESTRICT ON UPDATE CASCADE'
    );
    // Self-referencing foreign key.
    expect(ddl).toContain(
      'ALTER TABLE "employee" ADD CONSTRAINT "fk_employee_manager_id" FOREIGN KEY ("manager_id") REFERENCES "employee"("employee_id") ON DELETE SET NULL ON UPDATE CASCADE'
    );
  });

  it("produces UNIQUE constraints", () => {
    const ddl = generateDDL(sampleDiagram());
    expect(ddl).toContain(
      'ALTER TABLE "project" ADD CONSTRAINT "project_code_unique" UNIQUE ("code")'
    );
  });

  it("produces a composite UNIQUE constraint", () => {
    const ddl = generateDDL(
      diagram({
        tables: [
          table({
            id: "tbl-employee_project",
            name: "employee_project",
            columns: [
              column({ id: "c-ep-emp", name: "employee_id", type: "integer" }),
              column({ id: "c-ep-proj", name: "project_id", type: "integer" }),
              column({ id: "c-ep-role", name: "role", type: "text" }),
            ],
          }),
        ],
        uniqueConstraints: [
          uniqueConstraint({
            id: "uc-ep",
            tableId: "tbl-employee_project",
            columnIds: ["c-ep-emp", "c-ep-proj"],
            name: "employee_project_role_unique",
          }),
        ],
      })
    );
    expect(ddl).toContain(
      'ALTER TABLE "employee_project" ADD CONSTRAINT "employee_project_role_unique" UNIQUE ("employee_id", "project_id")'
    );
  });

  it("produces CREATE INDEX statements", () => {
    const ddl = generateDDL(sampleDiagram());
    expect(ddl).toContain(
      'CREATE INDEX "idx_employee_department" ON "employee" ("department_id")'
    );
  });

  it("produces a UNIQUE index", () => {
    const order = table({
      id: "tbl-order",
      name: "order",
      columns: [column({ id: "c-o-cust", name: "customer_id", type: "integer" })],
    });
    const ddl = generateDDL(
      diagram({
        tables: [order],
        indexes: [
          index({
            id: "idx-uniq",
            tableId: "tbl-order",
            columnIds: ["c-o-cust"],
            unique: true,
            name: "idx_order_customer",
          }),
        ],
      })
    );
    expect(ddl).toContain(
      'CREATE UNIQUE INDEX "idx_order_customer" ON "order" ("customer_id")'
    );
  });

  it("quotes reserved-word table and column names", () => {
    const ddl = generateDDL(
      diagram({
        tables: [
          table({
            name: "order",
            columns: [
              column({ name: "order", type: "integer" }),
              column({ name: "select", type: "text" }),
            ],
          }),
        ],
      })
    );
    expect(ddl).toContain('CREATE TABLE "order" (');
    expect(ddl).toContain('"order" INTEGER');
    expect(ddl).toContain('"select" TEXT');
  });

  it("escapes embedded double quotes in identifiers", () => {
    const ddl = generateDDL(
      diagram({
        tables: [table({ name: 'weird"table', columns: [column({ name: 'col"x' })] })],
      })
    );
    expect(ddl).toContain('CREATE TABLE "weird""table" (');
    expect(ddl).toContain('"col""x"');
  });

  it("orders tables before constraints so circular foreign keys work", () => {
    const department = table({
      id: "tbl-department",
      name: "department",
      columns: [
        column({ id: "c-d-id", name: "department_id", type: "integer", nullable: false, primaryKey: true }),
        column({ id: "c-d-head", name: "head_employee_id", type: "integer", nullable: true }),
      ],
    });
    const employee = table({
      id: "tbl-employee",
      name: "employee",
      columns: [
        column({ id: "c-e-id", name: "employee_id", type: "integer", nullable: false, primaryKey: true }),
        column({ id: "c-e-dept", name: "department_id", type: "integer", nullable: false }),
      ],
    });
    const ddl = generateDDL(
      diagram({
        tables: [department, employee],
        relationships: [
          relationship({
            id: "rel-dept-head",
            sourceTableId: "tbl-department",
            sourceColumnId: "c-d-head",
            targetTableId: "tbl-employee",
            targetColumnId: "c-e-id",
            onDelete: "set null",
            onUpdate: "cascade",
          }),
          relationship({
            id: "rel-emp-dept",
            sourceTableId: "tbl-employee",
            sourceColumnId: "c-e-dept",
            targetTableId: "tbl-department",
            targetColumnId: "c-d-id",
            onDelete: "restrict",
            onUpdate: "cascade",
          }),
        ],
      })
    );
    // Both CREATE TABLE statements must appear before either ALTER TABLE FK.
    const firstCreate = ddl.indexOf("CREATE TABLE");
    const lastCreate = ddl.lastIndexOf("CREATE TABLE");
    const firstAlter = ddl.indexOf("ALTER TABLE");
    expect(firstCreate).toBeGreaterThanOrEqual(0);
    expect(lastCreate).toBeGreaterThan(firstCreate);
    expect(firstAlter).toBeGreaterThan(lastCreate);
  });

  it("throws when a relationship references an unknown table", () => {
    expect(() =>
      generateDDL(
        diagram({
          tables: [table({ name: "employee" })],
          relationships: [relationship({ sourceTableId: "tbl-missing", targetTableId: "tbl-employee" })],
        })
      )
    ).toThrow(/unknown table/);
  });

  it("throws when a relationship references an unknown column", () => {
    expect(() =>
      generateDDL(
        diagram({
          tables: [
            table({ id: "tbl-a", name: "a", columns: [column({ id: "c-a", name: "id" })] }),
            table({ id: "tbl-b", name: "b", columns: [column({ id: "c-b", name: "id" })] }),
          ],
          relationships: [
            relationship({
              sourceTableId: "tbl-a",
              sourceColumnId: "col-missing",
              targetTableId: "tbl-b",
              targetColumnId: "c-b",
            }),
          ],
        })
      )
    ).toThrow(/unknown column/);
  });

  it("returns an empty string for a diagram with no tables", () => {
    expect(generateDDL(diagram({ tables: [] }))).toBe("");
  });

  it("produces a terminating semicolon after the last statement", () => {
    const ddl = generateDDL(
      diagram({ tables: [table({ name: "t", columns: [column()] })] })
    );
    expect(ddl.endsWith(";")).toBe(true);
  });

  it("produces no DROP/TRUNCATE/DELETE statements", () => {
    const ddl = generateDDL(sampleDiagram());
    const upper = ddl.toUpperCase();
    expect(upper).not.toContain("DROP");
    expect(upper).not.toContain("TRUNCATE");
    // "ON DELETE <action>" is a referential action, not a destructive
    // DELETE statement, so check per-statement that none starts with DELETE.
    const statements = upper.split(";").map((s) => s.trim()).filter((s) => s.length > 0);
    expect(statements.some((s) => /^DELETE\b/.test(s))).toBe(false);
  });
});
