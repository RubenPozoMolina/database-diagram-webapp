import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import { applySchemaRouter } from "../routes/apply-schema";

// The connection/query/end mocks are shared across every Client instance so
// tests can observe the statements sent to PostgreSQL and pre-configure
// failure behaviour (e.g. reject the first query call).
const sharedConnectMock: Mock = vi.fn().mockResolvedValue(undefined);
const sharedQueryMock: Mock = vi.fn().mockResolvedValue(undefined);
const sharedEndMock: Mock = vi.fn().mockResolvedValue(undefined);

vi.mock("pg", () => ({
  Client: vi.fn().mockImplementation(() => ({
    connect: sharedConnectMock,
    query: sharedQueryMock,
    end: sharedEndMock
  }))
}));

const baseRequest = {
  host: "localhost",
  port: 5432,
  database: "testdb",
  user: "testuser",
  password: "testpass",
  ddl: "CREATE TABLE test (id serial PRIMARY KEY);",
  confirm: true
};

describe("apply-schema route", () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/api/apply-schema", applySchemaRouter);
    // Restore default implementations before each test so failure setups
    // (mockRejectedValueOnce) do not leak between tests.
    sharedConnectMock.mockReset();
    sharedQueryMock.mockReset();
    sharedEndMock.mockReset();
    sharedConnectMock.mockResolvedValue(undefined);
    sharedQueryMock.mockResolvedValue(undefined);
    sharedEndMock.mockResolvedValue(undefined);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when confirm is false", async () => {
    const res = await request(app)
      .post("/api/apply-schema")
      .send({ ...baseRequest, confirm: false });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Confirmation required");
    expect(res.body.ddlPreview).toBe("CREATE TABLE test (id serial PRIMARY KEY);");
    // No connection attempt when confirmation is missing.
    expect(sharedConnectMock).not.toHaveBeenCalled();
    expect(sharedQueryMock).not.toHaveBeenCalled();
  });

  it("applies schema when confirm is true", async () => {
    const res = await request(app)
      .post("/api/apply-schema")
      .send(baseRequest);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(sharedConnectMock).toHaveBeenCalledTimes(1);
    expect(sharedEndMock).toHaveBeenCalledTimes(1);
  });

  it("executes DDL within a transaction (BEGIN / COMMIT)", async () => {
    await request(app).post("/api/apply-schema").send(baseRequest);

    expect(sharedQueryMock).toHaveBeenCalledWith("BEGIN");
    expect(sharedQueryMock).toHaveBeenCalledWith("COMMIT");
  });

  it("sets statement_timeout to the default execution timeout", async () => {
    await request(app).post("/api/apply-schema").send(baseRequest);

    expect(sharedQueryMock).toHaveBeenCalledWith(
      expect.stringMatching(/^SET statement_timeout = 30000$/)
    );
  });

  it("sets search_path to the chosen schema before executing DDL", async () => {
    await request(app)
      .post("/api/apply-schema")
      .send({ ...baseRequest, schema: "my_schema" });

    // set_config('search_path', 'my_schema', false) runs with the schema value.
    expect(sharedQueryMock).toHaveBeenCalledWith(
      "SELECT set_config('search_path', $1, false)",
      ["my_schema"]
    );

    // The DDL statement runs after search_path is set.
    const calls = sharedQueryMock.mock.calls as Array<[string, unknown[]]>;
    const setConfigIndex = calls.findIndex(([sql]) =>
      typeof sql === "string" && sql.includes("set_config('search_path'")
    );
    const ddlIndex = calls.findIndex(([sql]) =>
      typeof sql === "string" && sql.startsWith("CREATE TABLE")
    );
    expect(setConfigIndex).toBeGreaterThanOrEqual(0);
    expect(ddlIndex).toBeGreaterThan(setConfigIndex);
  });

  it("defaults search_path to public when schema is omitted", async () => {
    await request(app).post("/api/apply-schema").send(baseRequest);

    expect(sharedQueryMock).toHaveBeenCalledWith(
      "SELECT set_config('search_path', $1, false)",
      ["public"]
    );
  });

  it("rolls back and returns 400 when a DROP statement is rejected", async () => {
    const res = await request(app)
      .post("/api/apply-schema")
      .send({ ...baseRequest, ddl: "DROP TABLE test;", confirm: true });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Rejected");
    // Transaction is rolled back before the connection is closed.
    expect(sharedQueryMock).toHaveBeenCalledWith("BEGIN");
    expect(sharedQueryMock).toHaveBeenCalledWith("ROLLBACK");
    expect(sharedQueryMock).not.toHaveBeenCalledWith("COMMIT");
    expect(sharedEndMock).toHaveBeenCalledTimes(1);
  });

  it("rolls back and returns an error when query execution fails", async () => {
    sharedQueryMock.mockRejectedValueOnce(new Error("relation already exists"));

    const res = await request(app)
      .post("/api/apply-schema")
      .send(baseRequest);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain("relation already exists");
    expect(sharedQueryMock).toHaveBeenCalledWith("BEGIN");
    expect(sharedQueryMock).toHaveBeenCalledWith("ROLLBACK");
    expect(sharedQueryMock).not.toHaveBeenCalledWith("COMMIT");
    expect(sharedEndMock).toHaveBeenCalledTimes(1);
  });
});
