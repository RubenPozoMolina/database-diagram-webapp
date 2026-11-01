import { Router, RequestHandler } from "express";
import { TestConnectionRequestSchema, type TestConnectionRequest, type TestConnectionResult } from "../types/test-connection";

export const testConnectionRouter = Router();

const handleTestConnection: RequestHandler = async (req, res) => {
  const parseResult = TestConnectionRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid request", issues: parseResult.error.issues });
    return;
  }

  const { host, port, database, user, password } = parseResult.data;

  try {
    const { Client } = await import("pg");
    const client = new Client({
      host,
      port,
      database,
      user,
      password,
      connectionTimeoutMillis: 5000
    });

    await client.connect();
    const versionResult = await client.query("SELECT version()");
    await client.end();

    const result: TestConnectionResult = {
      success: true,
      message: "Connection successful",
      serverVersion: versionResult.rows[0]?.version
    };

    res.json(result);
  } catch (err) {
    const result: TestConnectionResult = {
      success: false,
      message: err instanceof Error ? err.message : "Unknown error"
    };
    res.status(400).json(result);
  }
};

testConnectionRouter.post("/", handleTestConnection);
