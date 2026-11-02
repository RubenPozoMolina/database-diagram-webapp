import { describe, it, expect } from "vitest";
import { validateDdlSafety, type DdlSafetyResult } from "./ddl-safety";

function expectRejected(result: DdlSafetyResult, expectedFragment: string): void {
  expect(result.safe).toBe(false);
  expect(result.error).toContain(expectedFragment);
  expect(result.statement).toBeDefined();
  expect(result.statement!.length).toBeGreaterThan(0);
}

function expectSafe(result: DdlSafetyResult): void {
  expect(result.safe).toBe(true);
  expect(result.error).toBeUndefined();
}

describe("validateDdlSafety", () => {
  // ------------------------------------------------------------------
  // CREATE statements are allowed
  // ------------------------------------------------------------------
  it("allows CREATE TABLE", () => {
    expectSafe(
      validateDdlSafety('CREATE TABLE "employee" ("id" INTEGER PRIMARY KEY);')
    );
  });

  it("allows CREATE TABLE IF NOT EXISTS", () => {
    expectSafe(
      validateDdlSafety('CREATE TABLE IF NOT EXISTS "employee" ("id" INTEGER);')
    );
  });

  it("allows CREATE INDEX", () => {
    expectSafe(
      validateDdlSafety('CREATE INDEX "idx_emp_dept" ON "employee" ("department_id");')
    );
  });

  it("allows CREATE UNIQUE INDEX", () => {
    expectSafe(
      validateDdlSafety('CREATE UNIQUE INDEX "idx_uniq" ON "order" ("customer_id");')
    );
  });

  it("allows CREATE SCHEMA", () => {
    expectSafe(validateDdlSafety("CREATE SCHEMA staging;"));
  });

  it("allows multiple CREATE statements", () => {
    expectSafe(
      validateDdlSafety(
        'CREATE TABLE "a" ("id" INTEGER); CREATE TABLE "b" ("id" INTEGER);'
      )
    );
  });

  // ------------------------------------------------------------------
  // ALTER TABLE ... ADD CONSTRAINT is allowed (creates new object)
  // ------------------------------------------------------------------
  it("allows ALTER TABLE ... ADD CONSTRAINT (composite primary key)", () => {
    expectSafe(
      validateDdlSafety(
        'ALTER TABLE "employee_project" ADD CONSTRAINT "pk_employee_project" PRIMARY KEY ("employee_id", "project_id");'
      )
    );
  });

  it("allows ALTER TABLE ... ADD CONSTRAINT (foreign key)", () => {
    expectSafe(
      validateDdlSafety(
        'ALTER TABLE "employee" ADD CONSTRAINT "fk_employee_department_id" FOREIGN KEY ("department_id") REFERENCES "department"("department_id") ON DELETE RESTRICT ON UPDATE CASCADE;'
      )
    );
  });

  it("allows ALTER TABLE ... ADD CONSTRAINT (unique)", () => {
    expectSafe(
      validateDdlSafety(
        'ALTER TABLE "project" ADD CONSTRAINT "project_code_unique" UNIQUE ("code");'
      )
    );
  });

  // ------------------------------------------------------------------
  // ALTER TABLE ... ADD COLUMN is allowed (creates new object)
  // ------------------------------------------------------------------
  it("allows ALTER TABLE ... ADD COLUMN", () => {
    expectSafe(
      validateDdlSafety('ALTER TABLE "employee" ADD COLUMN "nickname" TEXT;')
    );
  });

  // ------------------------------------------------------------------
  // DROP statements are rejected
  // ------------------------------------------------------------------
  it("rejects DROP TABLE", () => {
    expectRejected(validateDdlSafety("DROP TABLE test;"), "DROP");
  });

  it("rejects DROP COLUMN", () => {
    expectRejected(
      validateDdlSafety('ALTER TABLE "employee" DROP COLUMN "nickname";'),
      "DROP COLUMN"
    );
  });

  it("rejects DROP CONSTRAINT", () => {
    expectRejected(
      validateDdlSafety('ALTER TABLE "employee" DROP CONSTRAINT "fk_emp_dept";'),
      "DROP CONSTRAINT"
    );
  });

  it("rejects DROP DATABASE", () => {
    expectRejected(validateDdlSafety("DROP DATABASE testdb;"), "DROP");
  });

  it("rejects DROP SCHEMA", () => {
    expectRejected(validateDdlSafety("DROP SCHEMA staging;"), "DROP");
  });

  it("rejects DROP INDEX", () => {
    expectRejected(validateDdlSafety("DROP INDEX idx_emp_dept;"), "DROP");
  });

  it("rejects DROP VIEW", () => {
    expectRejected(validateDdlSafety("DROP VIEW v_employee;"), "DROP");
  });

  it("rejects lowercase drop table", () => {
    expectRejected(validateDdlSafety("drop table test;"), "DROP");
  });

  it("rejects mixed-case Drop Table", () => {
    expectRejected(validateDdlSafety("Drop Table test;"), "DROP");
  });

  // ------------------------------------------------------------------
  // TRUNCATE statements are rejected
  // ------------------------------------------------------------------
  it("rejects TRUNCATE TABLE", () => {
    expectRejected(validateDdlSafety("TRUNCATE TABLE test;"), "TRUNCATE");
  });

  it("rejects truncate (lowercase)", () => {
    expectRejected(validateDdlSafety("truncate table test;"), "TRUNCATE");
  });

  // ------------------------------------------------------------------
  // DELETE statements are rejected
  // ------------------------------------------------------------------
  it("rejects DELETE statement", () => {
    expectRejected(validateDdlSafety("DELETE FROM test;"), "DELETE");
  });

  // ------------------------------------------------------------------
  // ALTER statements that modify existing objects are rejected
  // ------------------------------------------------------------------
  it("rejects ALTER TABLE ... ALTER COLUMN", () => {
    expectRejected(
      validateDdlSafety('ALTER TABLE "employee" ALTER COLUMN "name" TYPE TEXT;'),
      "ALTER COLUMN"
    );
  });

  it("rejects ALTER TABLE ... MODIFY COLUMN", () => {
    expectRejected(
      validateDdlSafety('ALTER TABLE "employee" MODIFY COLUMN "name" TEXT;'),
      "MODIFY COLUMN"
    );
  });

  it("rejects ALTER TABLE ... RENAME", () => {
    expectRejected(
      validateDdlSafety('ALTER TABLE "employee" RENAME TO "staff";'),
      "RENAME"
    );
  });

  it("rejects ALTER TABLE ... RENAME COLUMN", () => {
    expectRejected(
      validateDdlSafety('ALTER TABLE "employee" RENAME COLUMN "name" TO "full_name";'),
      "RENAME"
    );
  });

  it("rejects ALTER TABLE ... DROP COLUMN", () => {
    expectRejected(
      validateDdlSafety('ALTER TABLE "employee" DROP COLUMN "nickname";'),
      "DROP COLUMN"
    );
  });

  it("rejects ALTER TABLE ... DROP CONSTRAINT", () => {
    expectRejected(
      validateDdlSafety('ALTER TABLE "employee" DROP CONSTRAINT "fk_emp_dept";'),
      "DROP CONSTRAINT"
    );
  });

  // ------------------------------------------------------------------
  // ON DELETE / ON UPDATE referential actions are NOT treated as destructive
  // ------------------------------------------------------------------
  it("allows ALTER TABLE with ON DELETE CASCADE (referential action, not destructive)", () => {
    expectSafe(
      validateDdlSafety(
        'ALTER TABLE "employee" ADD CONSTRAINT "fk_emp_dept" FOREIGN KEY ("department_id") REFERENCES "department"("department_id") ON DELETE CASCADE ON UPDATE CASCADE;'
      )
    );
  });

  // ------------------------------------------------------------------
  // Non-CREATE, non-ALTER statements are rejected
  // ------------------------------------------------------------------
  it("rejects statements that do not start with CREATE or ALTER", () => {
    const result = validateDdlSafety("GRANT SELECT ON test TO user;");
    expect(result.safe).toBe(false);
    expect(result.error).toContain("only CREATE statements are allowed");
    // The trailing semicolon is the statement separator, so it is not part
    // of the reported statement.
    expect(result.statement).toBe("GRANT SELECT ON test TO user");
  });

  it("rejects COMMENT statements", () => {
    const result = validateDdlSafety('COMMENT ON TABLE "employee" IS "staff";');
    expect(result.safe).toBe(false);
    expect(result.error).toContain("only CREATE statements are allowed");
  });

  // ------------------------------------------------------------------
  // SQL comments are stripped before analysis
  // ------------------------------------------------------------------
  it("ignores keywords inside line comments", () => {
    expectSafe(
      validateDdlSafety('CREATE TABLE "test" ("id" INTEGER); -- DROP TABLE old;')
    );
  });

  it("ignores keywords inside block comments", () => {
    expectSafe(
      validateDdlSafety('CREATE TABLE "test" ("id" INTEGER) /* DROP TABLE old; */;')
    );
  });

  // ------------------------------------------------------------------
  // First unsafe statement wins
  // ------------------------------------------------------------------
  it("reports the first unsafe statement when multiple are present", () => {
    const result = validateDdlSafety(
      'CREATE TABLE "a" ("id" INTEGER); DROP TABLE "b"; CREATE TABLE "c" ("id" INTEGER);'
    );
    expectRejected(result, "DROP");
    expect(result.statement).toBe('DROP TABLE "b"');
  });

  // ------------------------------------------------------------------
  // Empty DDL is safe
  // ------------------------------------------------------------------
  it("treats empty DDL as safe", () => {
    expectSafe(validateDdlSafety(""));
    expectSafe(validateDdlSafety("; ; ;"));
  });

  // ------------------------------------------------------------------
  // Realistic ddl-generator output passes safety
  // ------------------------------------------------------------------
  it("allows realistic generated DDL with CREATE TABLE + ALTER ADD CONSTRAINT + CREATE INDEX", () => {
    const ddl = [
      'CREATE TABLE "department" (\n  "department_id" INTEGER NOT NULL,\n  "name" TEXT NOT NULL\n)',
      'CREATE TABLE "employee" (\n  "employee_id" INTEGER NOT NULL,\n  "department_id" INTEGER NOT NULL\n)',
      'ALTER TABLE "employee" ADD CONSTRAINT "fk_employee_department_id" FOREIGN KEY ("department_id") REFERENCES "department"("department_id") ON DELETE RESTRICT ON UPDATE CASCADE',
      'CREATE INDEX "idx_employee_department" ON "employee" ("department_id")',
    ].join(";\n") + ";";

    expectSafe(validateDdlSafety(ddl));
  });
});
