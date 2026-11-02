import { Router } from "express";
import type { RequestHandler } from "express";
import { ApplySchemaRequestSchema, type ApplySchemaResult } from "../types/apply-schema";
import { validateDdlSafety } from "../services/ddl-safety";

export const applySchemaRouter = Router();

const handleApplySchema: RequestHandler = async (req, res) => {
  const parseResult = ApplySchemaRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid request", issues: parseResult.error.issues });
    return;
  }

  const { host, port, database, user, password, ddl, confirm } = parseResult.data;

  if (!confirm) {
    res.status(400).json({
      error: "Confirmation required",
      message: "DDL must be explicitly confirmed before execution.",
      ddlPreview: ddl
    });
    return;
  }

  // Safety validation: reject any DDL that would modify or drop existing objects.
  const safety = validateDdlSafety(ddl);
  if (!safety.safe) {
    res.status(400).json({
      error: "Rejected",
      message: safety.error ?? "DDL failed safety validation.",
      statement: safety.statement
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

    // Split DDL by semicolons and execute each statement.
    // All statements have already passed the safety check above.
    const statements = ddl
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const stmt of statements) {
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
