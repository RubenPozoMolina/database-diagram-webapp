import { Router } from "express";
import type { RequestHandler } from "express";
import { ReadSchemaRequestSchema, type SchemaInfo } from "../types/read-schema";

export const readSchemaRouter = Router();

const handleReadSchema: RequestHandler = async (req, res) => {
  const parseResult = ReadSchemaRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid request", issues: parseResult.error.issues });
    return;
  }

  const { host, port, database, user, password, schema } = parseResult.data;

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

    const tablesResult = await client.query(
      `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = $1 AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `,
      [schema]
    );

    const schemaInfo: SchemaInfo = { tables: [] };

    for (const row of tablesResult.rows) {
      const tableName = row.table_name;

      const columnsResult = await client.query(
        `
        SELECT column_name, data_type, is_nullable, column_default, character_maximum_length
        FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2
        ORDER BY ordinal_position
      `,
        [schema, tableName]
      );

      const pkResult = await client.query(
        `
        SELECT kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.constraint_type = 'PRIMARY KEY'
          AND tc.table_schema = $1
          AND tc.table_name = $2
      `,
        [schema, tableName]
      );

      const fkResult = await client.query(
        `
        SELECT kcu.column_name, ccu.table_name AS foreign_table, ccu.column_name AS foreign_column
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = $1
          AND tc.table_name = $2
      `,
        [schema, tableName]
      );

      schemaInfo.tables.push({
        name: tableName,
        columns: columnsResult.rows.map((col) => ({
          name: col.column_name,
          dataType: col.data_type,
          isNullable: col.is_nullable === "YES",
          columnDefault: col.column_default ?? null,
          maxLength: col.character_maximum_length ?? null
        })),
        primaryKeys: pkResult.rows.map((row) => row.column_name),
        foreignKeys: fkResult.rows.map((row) => ({
          column: row.column_name,
          foreignTable: row.foreign_table,
          foreignColumn: row.foreign_column
        })),
        uniqueConstraints: [],
        indexes: []
      });
    }

    await client.end();

    res.json(schemaInfo);
  } catch (err) {
    res.status(400).json({
      error: "Schema introspection failed",
      message: err instanceof Error ? err.message : "Unknown error"
    });
  }
};

readSchemaRouter.post("/", handleReadSchema);
