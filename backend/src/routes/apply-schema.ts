import { Router } from "express";
import type { RequestHandler } from "express";
import { validateDDLSafety } from "../services/ddl-safety-validator";
import { ApplySchemaRequestSchema, type ApplySchemaResult } from "../types/apply-schema";
import { validateDdlSafety } from "../services/ddl-safety";

/**
 * Default DDL execution timeout in milliseconds (30 seconds per spec §4.6).
 * Aborts execution if a statement takes longer, preventing the frontend
 * from being blocked indefinitely.
 */
const DEFAULT_EXECUTION_TIMEOUT_MS = 30_000;

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

  // Safety validation: reject any DDL that would modify or drop existing objects.
  // Both safety validators run: the ticket's validateDdlSafety (returns the
  // offending statement) and the trunk's validateDDLSafety (returns a list of
  // errors). Either rejection fails the request before any database connection,
  // and the response carries both shapes so every caller is satisfied.
  const safety = validateDdlSafety(ddl);
  const validation = validateDDLSafety(ddl);

  if (!safety.safe || !validation.valid) {
    res.status(400).json({
      error: "Rejected",
      message: [
        safety.error ?? "DDL failed safety validation.",
        "DDL contains destructive statements. Existing objects are never dropped or altered."
      ].join(" "),
      statement: safety.statement,
      details: validation.errors,
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

    try {
      // Execute DDL within a transaction so a failure can be rolled back
      // and no partial changes are left in an inconsistent state (spec §5.3).
      await client.query("BEGIN");

      // Bound each statement's execution time so the frontend is not blocked
      // indefinitely (spec §4.6). statement_timeout is a constant, not user input.
      await client.query(`SET statement_timeout = ${DEFAULT_EXECUTION_TIMEOUT_MS}`);

      // Execute DDL against the chosen schema by setting search_path.
      // set_config is parameterised, so the schema value is never concatenated
      // into SQL (defence against SQL injection).
      await client.query("SELECT set_config('search_path', $1, false)", [schema]);

      // Split DDL by semicolons and execute each statement against the schema.
      // All statements have already passed the safety checks above.
      const statements = ddl
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      for (const stmt of statements) {
        await client.query(stmt);
      }

      await client.query("COMMIT");
    } catch (err) {
      // Roll back any partial changes on failure.
      try {
        await client.query("ROLLBACK");
      } catch {
        // Ignore errors during rollback.
      }
      throw err;
    } finally {
      await client.end();
    }

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
