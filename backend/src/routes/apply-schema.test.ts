import { describe, it, expect, vi, afterEach } from "vitest";
import { applySchemaRouter } from "../routes/apply-schema";
import express from "express";

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
    const { request } = await import("supertest");
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
    const { request } = await import("supertest");
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
    const { request } = await import("supertest");
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
  });
});
