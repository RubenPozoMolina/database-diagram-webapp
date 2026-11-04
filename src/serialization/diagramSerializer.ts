/**
 * JSON serialization for database diagrams.
 *
 * Converts the in-memory {@link Diagram} model into the JSON serialization
 * format defined by src/schema/diagram.schema.json (version 1.0.0). The
 * exported payload contains only diagram data (tables, columns, types, keys,
 * constraints, indexes, relationships) and never database credentials, which
 * live in a separate connection model outside the diagram.
 *
 * Defense-in-depth: {@link stripCredentials} is applied to every export
 * payload so that even if the diagram model is later extended to carry
 * connection details, host, port, database, user and password can never
 * reach the JSON export.
 */

import type {
  Column,
  Diagram,
  Index,
  Relationship,
  ReferentialAction,
  Table,
  UniqueConstraint,
} from '../types/diagram';

export const DIAGRAM_JSON_VERSION = '1.0.0';

/**
 * Database connection credential field names that must never appear in a
 * JSON export payload. Kept in a separate connection model and never
 * serialized with diagram data.
 */
export const CREDENTIAL_FIELDS = new Set([
  'host',
  'port',
  'database',
  'user',
  'password',
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
  if (value !== null && typeof value === 'object') {
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
    onDelete: relationship.onDelete ?? 'no action',
    onUpdate: relationship.onUpdate ?? 'no action',
  };
}

/**
 * Serialize a single in-memory {@link Index} into a {@link SerializedIndex}.
 *
 * The in-memory index model stores its column IDs as an array (supporting
 * composite indexes) plus the owning table's ID; the serialized form carries
 * the same fields straight through so indexes can be redistributed to tables
 * on deserialization.
 */
function serializeIndex(index: Index): SerializedIndex {
  return {
    id: index.id,
    tableId: index.tableId,
    columnIds: index.columnIds,
    unique: false,
    name: index.name,
  };
}

/**
 * Serialize a single in-memory {@link UniqueConstraint} into a
 * {@link SerializedUniqueConstraint}. The owning table's ID is carried so the
 * constraint can be redistributed to the correct table on deserialization,
 * and the column ID array supports composite (multi-column) constraints.
 */
function serializeUniqueConstraint(constraint: UniqueConstraint): SerializedUniqueConstraint {
  return {
    id: constraint.id,
    tableId: constraint.tableId,
    columnIds: constraint.columnIds,
    name: constraint.name ?? null,
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
  // Collect indexes from all tables into the diagram-level serialized array.
  const indexes: SerializedIndex[] = [];
  for (const table of diagram.tables) {
    for (const index of table.indexes) {
      indexes.push(serializeIndex(index));
    }
  }
  const exportPayload: SerializedExport = {
    version: DIAGRAM_JSON_VERSION,
    diagram: {
      id: diagram.id,
      name: diagram.name,
      tables: diagram.tables.map(serializeTable),
      relationships: diagram.relationships.map(serializeRelationship),
      uniqueConstraints: diagram.uniqueConstraints.map(serializeUniqueConstraint),
      indexes,
      createdAt: now,
      updatedAt: now,
    },
  };
  // Defense-in-depth: strip any credential fields that might have been
  // added to the payload so they never reach the JSON export.
  return stripCredentials(exportPayload);
}
