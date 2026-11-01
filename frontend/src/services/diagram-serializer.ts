// Diagram JSON serialization utilities
// Ensures no database credentials are ever serialized to JSON

import type { Diagram, DiagramJSON } from "./diagram";

export const DIAGRAM_JSON_VERSION = "1.0.0";

export function serializeDiagram(diagram: Diagram): DiagramJSON {
  return {
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
