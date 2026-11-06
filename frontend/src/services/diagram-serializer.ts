// Diagram JSON serialization utilities
// Ensures no database credentials are ever serialized to JSON

import type { Diagram, DiagramJSON } from "../types/diagram";

export const DIAGRAM_JSON_VERSION = "1.0.0";

/**
 * Database connection credential field names that must never appear in a
 * JSON export payload. Kept in a separate connection model and never
 * serialized with diagram data.
 */
export const CREDENTIAL_FIELDS = new Set([
  "host",
  "port",
  "database",
  "user",
  "password",
]);

/**
 * Recursively strips credential fields from a serialized object.
 *
 * Defense-in-depth guard applied to every export payload. Even if the
 * in-memory diagram model is later extended to carry connection details,
 * this ensures host, port, database, user and password never reach the
 * JSON export. Arrays and plain objects are traversed recursively;
 * primitives are returned unchanged.
 */
export function stripCredentials<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(stripCredentials) as unknown as T;
  }
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      if (CREDENTIAL_FIELDS.has(key.toLowerCase())) {
        continue;
      }
      result[key] = stripCredentials(val);
    }
    return result as unknown as T;
  }
  return value;
}

export function serializeDiagram(diagram: Diagram): DiagramJSON {
  const payload: DiagramJSON = {
    version: DIAGRAM_JSON_VERSION,
    diagram: {
      id: diagram.id,
      name: diagram.name,
      tables: diagram.tables.map((table) => ({
        id: table.id,
        name: table.name,
        x: table.x,
        y: table.y,
        width: table.width,
        height: table.height,
        columns: table.columns.map((column) => ({
          id: column.id,
          name: column.name,
          type: column.type,
          length: column.length,
          nullable: column.nullable,
          primaryKey: column.primaryKey,
          unique: column.unique,
          defaultValue: column.defaultValue,
          comment: column.comment
        }))
      })),
      relationships: diagram.relationships.map((rel) => ({
        id: rel.id,
        sourceTableId: rel.sourceTableId,
        sourceColumnId: rel.sourceColumnId,
        targetTableId: rel.targetTableId,
        targetColumnId: rel.targetColumnId,
        onDelete: rel.onDelete,
        onUpdate: rel.onUpdate
      })),
      uniqueConstraints: diagram.uniqueConstraints.map((uc) => ({
        id: uc.id,
        tableId: uc.tableId,
        columnIds: uc.columnIds,
        name: uc.name
      })),
      indexes: diagram.indexes.map((idx) => ({
        id: idx.id,
        tableId: idx.tableId,
        columnIds: idx.columnIds,
        unique: idx.unique,
        name: idx.name
      })),
      createdAt: diagram.createdAt,
      updatedAt: diagram.updatedAt
    }
  };
  // Defense-in-depth: strip any credential fields that might have been
  // added to the payload so they never reach the JSON export.
  return stripCredentials(payload);
}

export function deserializeDiagram(json: DiagramJSON): Diagram {
  if (json.version !== DIAGRAM_JSON_VERSION) {
    throw new Error(`Unsupported diagram JSON version: ${json.version}`);
  }

  const { diagram } = json;

  return {
    id: diagram.id,
    name: diagram.name,
    tables: diagram.tables.map((table) => ({
      id: table.id,
      name: table.name,
      x: table.x,
      y: table.y,
      width: table.width,
      height: table.height,
      columns: table.columns.map((column) => ({
        id: column.id,
        name: column.name,
        type: column.type,
        length: column.length,
        nullable: column.nullable,
        primaryKey: column.primaryKey,
        unique: column.unique,
        defaultValue: column.defaultValue,
        comment: column.comment
      }))
    })),
    relationships: diagram.relationships.map((rel) => ({
      id: rel.id,
      sourceTableId: rel.sourceTableId,
      sourceColumnId: rel.sourceColumnId,
      targetTableId: rel.targetTableId,
      targetColumnId: rel.targetColumnId,
      onDelete: rel.onDelete,
      onUpdate: rel.onUpdate
    })),
    uniqueConstraints: diagram.uniqueConstraints.map((uc) => ({
      id: uc.id,
      tableId: uc.tableId,
      columnIds: uc.columnIds,
      name: uc.name
    })),
    indexes: diagram.indexes.map((idx) => ({
      id: idx.id,
      tableId: idx.tableId,
      columnIds: idx.columnIds,
      unique: idx.unique,
      name: idx.name
    })),
    createdAt: diagram.createdAt,
    updatedAt: diagram.updatedAt
  };
}

export function hasCredentials(json: unknown): boolean {
  const obj = json as Record<string, unknown>;
  const credentialKeys = ["host", "port", "database", "user", "password", "dbname", "pwd", "secret"];
  return credentialKeys.some((key) => key in obj);
}
