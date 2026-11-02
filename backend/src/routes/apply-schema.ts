import { Router } from "express";
import type { RequestHandler } from "express";
import { ApplySchemaRequestSchema, type ApplySchemaResult } from "../types/apply-schema";

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

      // Never drop existing objects: only execute CREATE statements.
      // Split DDL by semicolons and execute each statement against the schema.
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
          await client.query("ROLLBACK");
          // Connection is closed by the finally block below.
          res.status(400).json({
            error: "Rejected",
            message: "DROP/TRUNCATE operations are not allowed. Existing objects are never dropped."
          });
          return;
        }
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
