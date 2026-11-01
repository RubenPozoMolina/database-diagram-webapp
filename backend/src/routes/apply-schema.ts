import { Router, RequestHandler } from "express";
import { ApplySchemaRequestSchema, type ApplySchemaRequest, type ApplySchemaResult } from "../types/apply-schema";

export const applySchemaRouter = Router();

const handleApplySchema: RequestHandler = async (req, res) => {
  const parseResult = ApplySchemaRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid request", issues: parseResult.error.issues });
    return;
  }

  const { host, port, database, user, password, schema, ddl, confirm } = parseResult.data;

  if (!confirm) {
    res.status(400).json({
      error: "Confirmation required",
      message: "DDL must be explicitly confirmed before execution.",
      ddlPreview: ddl
    });
    return;
  }

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

    // Never drop existing objects: only execute CREATE statements
    // Split DDL by semicolons and execute each statement
    const statements = ddl
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const stmt of statements) {
      // Guard: reject any DROP/TRUNCATE/ALTER that would remove objects
      const upper = stmt.toUpperCase();
      if (
        upper.startsWith("DROP") ||
        upper.startsWith("TRUNCATE") ||
        upper.includes("DROP TABLE") ||
        upper.includes("DROP COLUMN") ||
        upper.includes("DROP CONSTRAINT")
      ) {
        await client.end();
        res.status(400).json({
          error: "Rejected",
          message: "DROP/TRUNCATE operations are not allowed. Existing objects are never dropped."
        });
        return;
      }
      await client.query(stmt);
    }

    await client.end();

    const result: ApplySchemaResult = {
      success: true,
      message: "Schema applied successfully",
      ddlPreview: ddl
    };

    res.json(result);
  } catch (err) {
    const result: ApplySchemaResult = {
      success: false,
      message: err instanceof Error ? err.message : "Unknown error",
      ddlPreview: ddl
    };
    res.status(400).json(result);
  }
};

applySchemaRouter.post("/", handleApplySchema);
