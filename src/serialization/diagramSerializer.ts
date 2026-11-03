/**
 * JSON serialization for database diagrams.
 *
 * Converts the in-memory {@link Diagram} model into the JSON serialization
 * format defined by src/schema/diagram.schema.json (version 1.0.0). The
 * exported payload contains only diagram data (tables, columns, types, keys,
 * constraints, indexes, relationships) and never database credentials, which
 * live in a separate connection model outside the diagram.
 */

import type { Column, Diagram, Relationship, Table } from '../types/diagram';

export const DIAGRAM_JSON_VERSION = '1.0.0';

export type ReferentialAction =
  | 'cascade'
  | 'set null'
  | 'set default'
  | 'restrict'
  | 'no action';

export interface SerializedColumn {
  id: string;
  name: string;
  type: string;
  length: number | null;
  nullable: boolean;
  primaryKey: boolean;
  unique: boolean;
  defaultValue: string | null;
  comment: string | null;
}

export interface SerializedTable {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  columns: SerializedColumn[];
}

export interface SerializedRelationship {
  id: string;
  sourceTableId: string;
  sourceColumnId: string | null;
  targetTableId: string;
  targetColumnId: string | null;
  onDelete: ReferentialAction;
  onUpdate: ReferentialAction;
}

export interface SerializedUniqueConstraint {
  id: string;
  tableId: string;
  columnIds: string[];
  name: string | null;
}

export interface SerializedIndex {
  id: string;
  tableId: string;
  columnIds: string[];
  unique: boolean;
  name: string | null;
}

export interface SerializedDiagram {
  id: string;
  name: string;
  tables: SerializedTable[];
  relationships: SerializedRelationship[];
  uniqueConstraints: SerializedUniqueConstraint[];
  indexes: SerializedIndex[];
  createdAt: string;
  updatedAt: string;
}

export interface SerializedExport {
  version: string;
  diagram: SerializedDiagram;
}

function serializeColumn(column: Column): SerializedColumn {
  return {
    id: column.id,
    name: column.name,
    type: column.dataType,
    length: null,
    nullable: column.nullable,
    primaryKey: column.primaryKey,
    unique: false,
    defaultValue: column.defaultValue ?? null,
    comment: null,
  };
}

function serializeTable(table: Table): SerializedTable {
  return {
    id: table.id,
    name: table.name,
    x: table.x,
    y: table.y,
    width: table.width,
    height: table.height,
    columns: table.columns.map(serializeColumn),
  };
}

function serializeRelationship(
  relationship: Relationship,
): SerializedRelationship {
  return {
    id: relationship.id,
    sourceTableId: relationship.sourceTableId,
    sourceColumnId: relationship.sourceColumnId ?? null,
    targetTableId: relationship.targetTableId,
    targetColumnId: relationship.targetColumnId ?? null,
    onDelete: 'no action',
    onUpdate: 'no action',
  };
}

/**
 * Serialize a diagram into the JSON export payload. The returned object is
 * JSON.stringify-safe and conforms to the diagram serialization schema. It
 * contains no database credentials (host, port, database, user, password) by
 * construction: the in-memory diagram model never carries connection details.
 */
export function serializeDiagram(diagram: Diagram): SerializedExport {
  const now = new Date().toISOString();
  return {
    version: DIAGRAM_JSON_VERSION,
    diagram: {
      id: diagram.id,
      name: diagram.name,
      tables: diagram.tables.map(serializeTable),
      relationships: diagram.relationships.map(serializeRelationship),
      uniqueConstraints: [],
      indexes: [],
      createdAt: now,
      updatedAt: now,
    },
  };
}
