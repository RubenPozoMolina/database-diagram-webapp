import { describe, it, expect } from "vitest";
import { validateDDLSafety } from "./ddl-safety-validator";

function expectValid(ddl: string): void {
  const result = validateDDLSafety(ddl);
  expect(result.valid).toBe(true);
  expect(result.errors).toEqual([]);
}

function expectInvalid(ddl: string, expectedFragment: string): void {
  const result = validateDDLSafety(ddl);
  expect(result.valid).toBe(false);
  expect(result.errors.length).toBeGreaterThan(0);
  expect(result.errors.some((e) => e.includes(expectedFragment))).toBe(true);
}

describe("validateDDLSafety", () => {
  it("returns valid for an empty DDL script", () => {
    expect(validateDDLSafety("")).toEqual({ valid: true, errors: [] });
  });

  it("returns valid for CREATE TABLE statements", () => {
    expectValid('CREATE TABLE "employee" ("id" INTEGER NOT NULL PRIMARY KEY);');
  });

  it("returns valid for CREATE INDEX statements", () => {
    expectValid(
      'CREATE INDEX "idx_employee_department" ON "employee" ("department_id");',
    );
  });

  it("returns valid for a UNIQUE index", () => {
    expectValid(
      'CREATE UNIQUE INDEX "idx_order_customer" ON "order" ("customer_id");',
    );
  });

  it("returns valid for ALTER TABLE ... ADD CONSTRAINT (composite primary key)", () => {
    expectValid(
      'ALTER TABLE "employee_project" ADD CONSTRAINT "pk_employee_project" PRIMARY KEY ("employee_id", "project_id");',
    );
  });

  it("returns valid for ALTER TABLE ... ADD CONSTRAINT (foreign key)", () => {
    expectValid(
      'ALTER TABLE "employee" ADD CONSTRAINT "fk_employee_department_id" FOREIGN KEY ("department_id") REFERENCES "department"("department_id") ON DELETE RESTRICT ON UPDATE CASCADE;',
    );
  });

  it("returns valid for ALTER TABLE ... ADD CONSTRAINT (unique constraint)", () => {
    expectValid(
      'ALTER TABLE "project" ADD CONSTRAINT "project_code_unique" UNIQUE ("code");',
    );
  });

  it("returns valid for a full script with multiple CREATE and ALTER ADD CONSTRAINT statements", () => {
    expectValid(
      'CREATE TABLE "a" ("id" INTEGER NOT NULL PRIMARY KEY);\n' +
        'CREATE TABLE "b" ("id" INTEGER NOT NULL PRIMARY KEY);\n' +
        'ALTER TABLE "a" ADD CONSTRAINT "fk_a_b" FOREIGN KEY ("b_id") REFERENCES "b"("id");\n' +
        'CREATE INDEX "idx_a_b" ON "a" ("b_id");',
    );
  });

  it("rejects DROP TABLE statements", () => {
    expectInvalid('DROP TABLE "employee";', "DROP");
  });

  it("rejects DROP COLUMN statements", () => {
    expectInvalid(
      'ALTER TABLE "employee" DROP COLUMN "salary";',
      "ALTER statement that may modify existing objects",
    );
  });

  it("rejects DROP CONSTRAINT statements", () => {
    expectInvalid(
      'ALTER TABLE "employee" DROP CONSTRAINT "fk_employee_department_id";',
      "ALTER statement that may modify existing objects",
    );
  });

  it("rejects DROP INDEX statements", () => {
    expectInvalid('DROP INDEX "idx_employee_department";', "DROP");
  });

  it("rejects TRUNCATE statements", () => {
    expectInvalid('TRUNCATE TABLE "employee";', "TRUNCATE");
  });

  it("rejects DELETE statements", () => {
    expectInvalid('DELETE FROM "employee";', "DELETE");
  });

  it("rejects ALTER TABLE ... ALTER COLUMN statements", () => {
    expectInvalid(
      'ALTER TABLE "employee" ALTER COLUMN "salary" TYPE numeric;',
      "ALTER statement that may modify existing objects",
    );
  });

  it("rejects ALTER TABLE ... RENAME statements", () => {
    expectInvalid(
      'ALTER TABLE "employee" RENAME TO "staff";',
      "ALTER statement that may modify existing objects",
    );
  });

  it("rejects ALTER TABLE ... ADD COLUMN statements (modifies existing table)", () => {
    expectInvalid(
      'ALTER TABLE "employee" ADD COLUMN "phone" text;',
      "ALTER statement that may modify existing objects",
    );
  });

  it("rejects case-insensitive DROP statements", () => {
    expectInvalid('drop table "employee";', "DROP");
    expectInvalid('Drop Table "employee";', "DROP");
  });

  it("rejects case-insensitive TRUNCATE statements", () => {
    expectInvalid('truncate table "employee";', "TRUNCATE");
  });

  it("rejects case-insensitive DELETE statements", () => {
    expectInvalid('delete from "employee";', "DELETE");
  });

  it("collects errors for all invalid statements in a mixed script", () => {
    const result = validateDDLSafety(
      'CREATE TABLE "a" ("id" INTEGER NOT NULL PRIMARY KEY); DROP TABLE "b"; ALTER TABLE "c" DROP COLUMN "x";',
    );
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBe(2);
    expect(result.errors.some((e) => e.includes("DROP"))).toBe(true);
    expect(
      result.errors.some((e) =>
        e.includes("ALTER statement that may modify existing objects"),
      ),
    ).toBe(true);
  });

  it("rejects unknown statement types that are not CREATE", () => {
    expectInvalid("COMMENT ON TABLE \"employee\" IS 'staff';", "non-CREATE");
  });

  it("reports each error with the offending statement text", () => {
    const result = validateDDLSafety('DROP TABLE "employee";');
    expect(result.errors[0]).toContain('DROP TABLE "employee"');
  });
});
