import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { testConnectionRouter } from "../routes/test-connection";

vi.mock("pg", () => ({
  Client: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    query: vi.fn().mockResolvedValue({ rows: [{ version: "PostgreSQL 16.0" }] }),
    end: vi.fn().mockResolvedValue(undefined)
  }))
}));

describe("test-connection route", () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/api/test-connection", testConnectionRouter);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns success for valid connection", async () => {
    const res = await request(app)
      .post("/api/test-connection")
      .send({
        host: "localhost",
        port: 5432,
        database: "testdb",
        user: "testuser",
        password: "testpass"
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("Connection successful");
  });

  it("returns 400 for missing fields", async () => {
    const res = await request(app)
      .post("/api/test-connection")
      .send({ host: "" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid request");
  });

  it("returns 400 when connection fails", async () => {
    const { Client } = await import("pg");
    const mockConnect = vi.fn().mockRejectedValue(new Error("Connection refused"));
    (Client as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      connect: mockConnect,
      end: vi.fn().mockResolvedValue(undefined)
    }));

    const res = await request(app)
      .post("/api/test-connection")
      .send({
        host: "localhost",
        port: 5432,
        database: "testdb",
        user: "testuser",
        password: "testpass"
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
