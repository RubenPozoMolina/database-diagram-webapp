import { Router } from "express";
import type { RequestHandler } from "express";
import {
  ReadSchemaRequestSchema,
  type ReadSchemaRequest,
  type ReadSchemaResponse,
  type ReadSchemaError,
  type ColumnInfo,
  type PrimaryKey,
  type ForeignKey,
  type UniqueConstraint,
  type IndexInfo,
} from "../types/read-schema";
import { IntrospectionService, IntrospectionError } from "../services/introspection.service";

export const readSchemaRouter = Router();

const introspectionService = new IntrospectionService();

const handleReadSchema: RequestHandler = async (req, res) => {
  const parseResult = ReadSchemaRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ success: false, error: "Invalid request", issues: parseResult.error.issues } as ReadSchemaError);
    return;
  }

  const { host, port, database, user, password, schema } = parseResult.data;

  const { Client } = await import("pg");
  const client = new Client({
    host,
    port,
    database,
    user,
    password,
    connectionTimeoutMillis: 5000,
  });

  try {
    await client.connect();

    const { tables } = await introspectionService.introspectSchema(client, schema);

    const response: ReadSchemaResponse = {
      success: true,
      schema,
      tables: tables.map((table) => ({
        name: table.name,
        columns: table.columns.map((col) => ({
          name: col.column_name,
          dataType: col.data_type,
          isNullable: col.is_nullable === "YES",
          columnDefault: col.column_default ?? null,
          maxLength: col.character_maximum_length ?? null,
          numericPrecision: col.numeric_precision ?? null,
          numericScale: col.numeric_scale ?? null,
          datetimePrecision: col.datetime_precision ?? null,
          intervalType: col.interval_type ?? null,
        })) as ColumnInfo[],
        primaryKeys: groupByConstraint(table.primaryKeys, (pk) => ({
          constraintName: pk.constraint_name,
          columns: [pk.column_name],
        })) as PrimaryKey[],
        foreignKeys: table.foreignKeys.map((fk) => ({
          constraintName: fk.constraint_name,
          column: fk.column_name,
          foreignTable: fk.foreign_table_name,
          foreignColumn: fk.foreign_column_name,
          updateRule: fk.update_rule,
          deleteRule: fk.delete_rule,
        })) as ForeignKey[],
        uniqueConstraints: groupByConstraint(table.uniqueConstraints, (uk) => ({
          constraintName: uk.constraint_name,
          columns: [uk.column_name],
        })) as UniqueConstraint[],
        indexes: groupByIndex(table.indexes) as IndexInfo[],
      })),
    };

    await client.end();

    res.json(response);
  } catch (err) {
    await client.end().catch(() => {
      // Ignore errors during cleanup.
    });

    if (err instanceof IntrospectionError) {
      res.status(err.statusCode).json({ success: false, error: err.message } as ReadSchemaError);
      return;
    }

    res.status(500).json({ success: false, error: "Internal server error while introspecting the schema." } as ReadSchemaError);
  }
};

readSchemaRouter.post("/", handleReadSchema);

// ---------------------------------------------------------------------------
// Grouping helpers
// ---------------------------------------------------------------------------

/**
 * Groups raw constraint rows (primary keys or unique constraints) by
 * constraint name, merging their columns into a single entry per constraint.
 * Composite keys produce one entry with multiple columns.
 * Rows are expected to be ordered by constraint_name, column_position.
 */
function groupByConstraint<T extends { constraint_name: string; column_name: string }>(
  rows: T[],
): Array<{ constraintName: string; columns: string[] }> {
  const groups = new Map<string, { constraintName: string; columns: string[] }>();
  const order: string[] = [];

  for (const row of rows) {
    if (!groups.has(row.constraint_name)) {
      groups.set(row.constraint_name, {
        constraintName: row.constraint_name,
        columns: [],
      });
      order.push(row.constraint_name);
    }
    groups.get(row.constraint_name)!.columns.push(row.column_name);
  }

  return order.map((name) => groups.get(name)!);
}

/**
 * Groups raw index rows by index name, merging their columns into a single
 * entry per index. Composite indexes produce one entry with multiple columns.
 * Rows are expected to be ordered by index_name, column_position.
 */
function groupByIndex(
  rows: Array<{
    index_name: string;
    column_name: string;
    is_unique: boolean;
    is_primary: boolean;
    is_valid: boolean;
    index_type: string;
    index_definition: string;
  }>,
): Array<{
  name: string;
  columns: string[];
  isUnique: boolean;
  isPrimary: boolean;
  isValid: boolean;
  indexType: string;
  definition: string;
}> {
  const groups = new Map<string, {
    name: string;
    columns: string[];
    isUnique: boolean;
    isPrimary: boolean;
    isValid: boolean;
    indexType: string;
    definition: string;
  }>();
  const order: string[] = [];

  for (const row of rows) {
    if (!groups.has(row.index_name)) {
      groups.set(row.index_name, {
        name: row.index_name,
        columns: [],
        isUnique: row.is_unique,
        isPrimary: row.is_primary,
        isValid: row.is_valid,
        indexType: row.index_type,
        definition: row.index_definition,
      });
      order.push(row.index_name);
    }
    groups.get(row.index_name)!.columns.push(row.column_name);
  }

  return order.map((name) => groups.get(name)!);
}
