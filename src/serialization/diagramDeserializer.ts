/**
 * JSON deserialization for database diagrams.
 *
 * Converts a {@link SerializedExport} payload (produced by
 * {@link serializeDiagram} in diagramSerializer.ts) back into the in-memory
 * {@link Diagram} model. Validates the schema version and the structure of
 * the imported payload, throwing a descriptive error when the file is
 * invalid or unsupported.
 *
 * The deserialized payload never carries database credentials: the diagram
 * model only contains tables, columns, keys, constraints, indexes and
 * relationships.
 */

import type {
  Column,
  Diagram,
  Index,
  Relationship,
  Table,
  UniqueConstraint,
} from '../types/diagram';
import {
  DIAGRAM_JSON_VERSION,
  type SerializedColumn,
  type SerializedExport,
  type SerializedIndex,
  type SerializedRelationship,
  type SerializedTable,
  type SerializedUniqueConstraint,
} from './diagramSerializer';

/**
 * Error thrown when the imported JSON is invalid or unsupported.
 */
export class DiagramImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DiagramImportError';
  }
}

/**
 * Deserialize a single serialized column into the internal Column model.
 */
function deserializeColumn(column: SerializedColumn): Column {
  return {
    id: column.id,
    name: column.name,
    dataType: column.type,
    nullable: column.nullable,
    primaryKey: column.primaryKey,
    ...(column.defaultValue !== null && column.defaultValue !== undefined
      ? { defaultValue: column.defaultValue }
      : {}),
  };
}

/**
 * Deserialize a single serialized table into the internal Table model.
 *
 * Indexes are not stored on the serialized table; they live at the diagram
 * level (one SerializedIndex per index with a tableId) and are redistributed
 * to tables by {@link deserializeDiagram}.
 */
function deserializeTable(table: SerializedTable, indexes: Index[] = []): Table {
  return {
    id: table.id,
    name: table.name,
    x: table.x,
    y: table.y,
    width: table.width,
    height: table.height,
    columns: table.columns.map(deserializeColumn),
    indexes,
  };
}

/**
 * Deserialize a single serialized relationship into the internal
 * Relationship model. Serialized null column IDs become undefined.
 */
function deserializeRelationship(
  relationship: SerializedRelationship,
): Relationship {
  return {
    id: relationship.id,
    sourceTableId: relationship.sourceTableId,
    sourceColumnId:
      relationship.sourceColumnId !== null &&
      relationship.sourceColumnId !== undefined
        ? relationship.sourceColumnId
        : undefined,
    targetTableId: relationship.targetTableId,
    targetColumnId:
      relationship.targetColumnId !== null &&
      relationship.targetColumnId !== undefined
        ? relationship.targetColumnId
        : undefined,
  };
}

/**
 * Deserialize a single serialized unique constraint into the internal
 * UniqueConstraint model. Serialized null names become undefined.
 */
function deserializeUniqueConstraint(
  constraint: SerializedUniqueConstraint,
): UniqueConstraint {
  return {
    id: constraint.id,
    tableId: constraint.tableId,
    columnIds: constraint.columnIds,
    ...(constraint.name !== null && constraint.name !== undefined
      ? { name: constraint.name }
      : {}),
  };
}

/**
 * Deserialize a single serialized index into the internal Index model.
 *
 * The serialized form stores column IDs as an array (supporting composite
 * indexes) plus a table ID; the in-memory model stores the same fields.
 * A synthetic name is generated when the serialized name is null.
 */
function deserializeIndex(index: SerializedIndex): Index {
  const firstColumn = index.columnIds.length > 0 ? index.columnIds[0] : '';
  return {
    id: index.id,
    tableId: index.tableId,
    name: index.name !== null && index.name !== undefined ? index.name : `idx_${firstColumn}`,
    columnIds: index.columnIds,
  };
}

/**
 * Validate that a serialized index has the required structure.
 */
function validateIndex(index: unknown): asserts index is SerializedIndex {
  if (
    typeof index !== 'object' ||
    index === null ||
    !('id' in index) ||
    !('tableId' in index) ||
    !('columnIds' in index)
  ) {
    throw new DiagramImportError(
      'Invalid diagram file: index is missing required fields.',
    );
  }
  if (
    typeof (index as { id: unknown }).id !== 'string' ||
    typeof (index as { tableId: unknown }).tableId !== 'string' ||
    !Array.isArray((index as { columnIds: unknown }).columnIds) ||
    ((index as { columnIds: unknown[] }).columnIds as unknown[]).some(
      (id: unknown) => typeof id !== 'string',
    )
  ) {
    throw new DiagramImportError(
      'Invalid diagram file: index has fields with unexpected types.',
    );
  }
}

/**
 * Validate that the imported payload has the expected schema version.
 */
function validateVersion(payload: unknown): asserts payload is {
  version: string;
} {
  if (
    typeof payload !== 'object' ||
    payload === null ||
    !('version' in payload)
  ) {
    throw new DiagramImportError(
      'Invalid diagram file: missing schema version.',
    );
  }
  const version = (payload as { version: unknown }).version;
  if (typeof version !== 'string' || version !== DIAGRAM_JSON_VERSION) {
    throw new DiagramImportError(
      `Unsupported diagram file version: ${String(version)}. Expected ${DIAGRAM_JSON_VERSION}.`,
    );
  }
}

/**
 * Validate that the diagram root exists and has the required structure.
 */
function validateDiagramRoot(diagram: unknown): asserts diagram is {
  id: string;
  name: string;
  tables: unknown[];
  relationships: unknown[];
} {
  if (
    typeof diagram !== 'object' ||
    diagram === null ||
    !('id' in diagram) ||
    !('name' in diagram) ||
    !('tables' in diagram) ||
    !('relationships' in diagram)
  ) {
    throw new DiagramImportError(
      'Invalid diagram file: missing diagram root or required fields.',
    );
  }
  if (
    typeof (diagram as { id: unknown }).id !== 'string' ||
    typeof (diagram as { name: unknown }).name !== 'string' ||
    !Array.isArray((diagram as { tables: unknown }).tables) ||
    !Array.isArray((diagram as { relationships: unknown }).relationships)
  ) {
    throw new DiagramImportError(
      'Invalid diagram file: diagram fields have unexpected types.',
    );
  }
}

/**
 * Deserialize a SerializedExport payload into a Diagram.
 *
 * @throws {DiagramImportError} when the payload is invalid, has an
 *         unsupported version, or does not contain a supported diagram model.
 */
export function deserializeDiagram(payload: SerializedExport): Diagram {
  validateVersion(payload);
  const { diagram: serializedDiagram } = payload;
  validateDiagramRoot(serializedDiagram);

  // Build a map of tableId -> deserialized indexes from the diagram-level
  // serialized indexes array, so indexes can be redistributed to tables.
  const indexesByTable = new Map<string, Index[]>();
  for (const serializedIndex of serializedDiagram.indexes || []) {
    validateIndex(serializedIndex);
    const index = deserializeIndex(serializedIndex);
    const tableId = serializedIndex.tableId;
    const existing = indexesByTable.get(tableId) ?? [];
    existing.push(index);
    indexesByTable.set(tableId, existing);
  }

  const tables = serializedDiagram.tables.map((t): Table => {
    if (
      typeof t !== 'object' ||
      t === null ||
      !('id' in t) ||
      !('name' in t) ||
      !('x' in t) ||
      !('y' in t) ||
      !('width' in t) ||
      !('height' in t) ||
      !('columns' in t)
    ) {
      throw new DiagramImportError(
        `Invalid diagram file: table ${String(
          (t as { id?: unknown }).id ?? '<unknown>',
        )} is missing required fields.`,
      );
    }
    if (
      typeof (t as { id: unknown }).id !== 'string' ||
      typeof (t as { name: unknown }).name !== 'string' ||
      typeof (t as { x: unknown }).x !== 'number' ||
      typeof (t as { y: unknown }).y !== 'number' ||
      typeof (t as { width: unknown }).width !== 'number' ||
      typeof (t as { height: unknown }).height !== 'number' ||
      !Array.isArray((t as { columns: unknown }).columns)
    ) {
      throw new DiagramImportError(
        `Invalid diagram file: table ${String(
          (t as { id?: unknown }).id ?? '<unknown>',
        )} has fields with unexpected types.`,
      );
    }
    const table = deserializeTable(
      t as SerializedTable,
      indexesByTable.get(t.id) ?? [],
    );
    return table;
  });

  const relationships = serializedDiagram.relationships.map(
    (r): Relationship => {
      if (
        typeof r !== 'object' ||
        r === null ||
        !('id' in r) ||
        !('sourceTableId' in r) ||
        !('targetTableId' in r)
      ) {
        throw new DiagramImportError(
          'Invalid diagram file: relationship is missing required fields.',
        );
      }
      if (
        typeof (r as { id: unknown }).id !== 'string' ||
        typeof (r as { sourceTableId: unknown }).sourceTableId !== 'string' ||
        typeof (r as { targetTableId: unknown }).targetTableId !== 'string'
      ) {
        throw new DiagramImportError(
          'Invalid diagram file: relationship has fields with unexpected types.',
        );
      }
      return deserializeRelationship(r as SerializedRelationship);
    },
  );

  const uniqueConstraints: UniqueConstraint[] = (
    serializedDiagram.uniqueConstraints || []
  ).map((c): UniqueConstraint => {
    if (
      typeof c !== 'object' ||
      c === null ||
      !('id' in c) ||
      !('tableId' in c) ||
      !('columnIds' in c)
    ) {
      throw new DiagramImportError(
        'Invalid diagram file: unique constraint is missing required fields.',
      );
    }
    if (
      typeof (c as { id: unknown }).id !== 'string' ||
      typeof (c as { tableId: unknown }).tableId !== 'string' ||
      !Array.isArray((c as { columnIds: unknown }).columnIds)
    ) {
      throw new DiagramImportError(
        'Invalid diagram file: unique constraint has fields with unexpected types.',
      );
    }
    return deserializeUniqueConstraint(c as SerializedUniqueConstraint);
  });

  return {
    id: serializedDiagram.id,
    name: serializedDiagram.name,
    tables,
    relationships,
    uniqueConstraints,
  };
}

/**
 * Deserialize a raw parsed JSON value into a Diagram.
 *
 * This is the entry point used by the import UI. It accepts any JSON value
 * (e.g. the result of JSON.parse) and converts it to a SerializedExport
 * before deserializing, so type errors surface as DiagramImportError.
 *
 * @throws {DiagramImportError} when the JSON value is not a valid diagram
 *         export payload.
 */
export function deserializeJson(value: unknown): Diagram {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('version' in value) ||
    !('diagram' in value)
  ) {
    throw new DiagramImportError(
      'Invalid diagram file: missing version or diagram root.',
    );
  }
  return deserializeDiagram(value as SerializedExport);
}
