import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { applySchemaRouter } from "../routes/apply-schema";

vi.mock("pg", () => ({
  Client: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    query: vi.fn().mockResolvedValue(undefined),
    end: vi.fn().mockResolvedValue(undefined)
  }))
}));

describe("apply-schema route", () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/api/apply-schema", applySchemaRouter);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when confirm is false", async () => {
    const res = await request(app)
      .post("/api/apply-schema")
      .send({
        host: "localhost",
        port: 5432,
        database: "testdb",
        user: "testuser",
        password: "testpass",
        ddl: "CREATE TABLE test (id serial PRIMARY KEY);",
        confirm: false
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Confirmation required");
    expect(res.body.ddlPreview).toBe("CREATE TABLE test (id serial PRIMARY KEY);");
  });

  it("applies schema when confirm is true", async () => {
    const res = await request(app)
      .post("/api/apply-schema")
      .send({
        host: "localhost",
        port: 5432,
        database: "testdb",
        user: "testuser",
        password: "testpass",
        ddl: "CREATE TABLE test (id serial PRIMARY KEY);",
        confirm: true
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("rejects DROP statements", async () => {
    const res = await request(app)
      .post("/api/apply-schema")
      .send({
        host: "localhost",
        port: 5432,
        database: "testdb",
        user: "testuser",
        password: "testpass",
        ddl: "DROP TABLE test;",
        confirm: true
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Rejected");
    expect(res.body.message).toContain("DROP");
  });

  it("rejects DROP DATABASE statements", async () => {
    const res = await request(app)
      .post("/api/apply-schema")
      .send({
        host: "localhost",
        port: 5432,
        database: "testdb",
        user: "testuser",
        password: "testpass",
        ddl: "DROP DATABASE testdb;",
        confirm: true
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Rejected");
    expect(res.body.message).toContain("DROP");
  });

  it("rejects TRUNCATE statements", async () => {
    const res = await request(app)
      .post("/api/apply-schema")
      .send({
        host: "localhost",
        port: 5432,
        database: "testdb",
        user: "testuser",
        password: "testpass",
        ddl: "TRUNCATE TABLE test;",
        confirm: true
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Rejected");
    expect(res.body.message).toContain("TRUNCATE");
  });

  it("rejects DELETE statements", async () => {
    const res = await request(app)
      .post("/api/apply-schema")
      .send({
        host: "localhost",
        port: 5432,
        database: "testdb",
        user: "testuser",
        password: "testpass",
        ddl: "DELETE FROM test;",
        confirm: true
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Rejected");
    expect(res.body.message).toContain("DELETE");
  });

  it("rejects ALTER TABLE ... DROP COLUMN", async () => {
    const res = await request(app)
      .post("/api/apply-schema")
      .send({
        host: "localhost",
        port: 5432,
        database: "testdb",
        user: "testuser",
        password: "testpass",
        ddl: 'ALTER TABLE "employee" DROP COLUMN "nickname";',
        confirm: true
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Rejected");
    expect(res.body.message).toContain("DROP COLUMN");
  });

  it("rejects ALTER TABLE ... DROP CONSTRAINT", async () => {
    const res = await request(app)
      .post("/api/apply-schema")
      .send({
        host: "localhost",
        port: 5432,
        database: "testdb",
        user: "testuser",
        password: "testpass",
        ddl: 'ALTER TABLE "employee" DROP CONSTRAINT "fk_emp_dept";',
        confirm: true
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Rejected");
    expect(res.body.message).toContain("DROP CONSTRAINT");
  });

  it("rejects ALTER TABLE ... ALTER COLUMN", async () => {
    const res = await request(app)
      .post("/api/apply-schema")
      .send({
        host: "localhost",
        port: 5432,
        database: "testdb",
        user: "testuser",
        password: "testpass",
        ddl: 'ALTER TABLE "employee" ALTER COLUMN "name" TYPE TEXT;',
        confirm: true
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Rejected");
    expect(res.body.message).toContain("ALTER COLUMN");
  });

  it("rejects ALTER TABLE ... RENAME", async () => {
    const res = await request(app)
      .post("/api/apply-schema")
      .send({
        host: "localhost",
        port: 5432,
        database: "testdb",
        user: "testuser",
        password: "testpass",
        ddl: 'ALTER TABLE "employee" RENAME TO "staff";',
        confirm: true
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Rejected");
    expect(res.body.message).toContain("RENAME");
  });

  it("rejects statements that are not CREATE or ALTER", async () => {
    const res = await request(app)
      .post("/api/apply-schema")
      .send({
        host: "localhost",
        port: 5432,
        database: "testdb",
        user: "testuser",
        password: "testpass",
        ddl: "GRANT SELECT ON test TO user;",
        confirm: true
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Rejected");
    expect(res.body.message).toContain("only CREATE statements are allowed");
  });

  it("allows ALTER TABLE ... ADD CONSTRAINT (creates new constraint)", async () => {
    const res = await request(app)
      .post("/api/apply-schema")
      .send({
        host: "localhost",
        port: 5432,
        database: "testdb",
        user: "testuser",
        password: "testpass",
        ddl: 'ALTER TABLE "employee_project" ADD CONSTRAINT "pk_employee_project" PRIMARY KEY ("employee_id", "project_id");',
        confirm: true
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("allows CREATE TABLE statements", async () => {
    const res = await request(app)
      .post("/api/apply-schema")
      .send({
        host: "localhost",
        port: 5432,
        database: "testdb",
        user: "testuser",
        password: "testpass",
        ddl: 'CREATE TABLE "test" ("id" INTEGER PRIMARY KEY);',
        confirm: true
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("returns the rejected statement in the response", async () => {
    const res = await request(app)
      .post("/api/apply-schema")
      .send({
        host: "localhost",
        port: 5432,
        database: "testdb",
        user: "testuser",
        password: "testpass",
        ddl: "DROP TABLE test;",
        confirm: true
      });

    expect(res.status).toBe(400);
    expect(res.body.statement).toBe("DROP TABLE test");
  });

  it("returns descriptive error for rejected DDL", async () => {
    const res = await request(app)
      .post("/api/apply-schema")
      .send({
        host: "localhost",
        port: 5432,
        database: "testdb",
        user: "testuser",
        password: "testpass",
        ddl: 'ALTER TABLE "employee" DROP COLUMN "nickname";',
        confirm: true
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Rejected");
    expect(res.body.message).toContain("not allowed");
    expect(res.body.message).toContain("DROP COLUMN");
  });
});
