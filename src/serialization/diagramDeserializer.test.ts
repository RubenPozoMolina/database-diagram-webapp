import { describe, it, expect } from 'vitest';
import {
  deserializeJson,
  deserializeDiagram,
  DiagramImportError,
} from './diagramDeserializer';
import {
  DIAGRAM_JSON_VERSION,
  serializeDiagram,
  type SerializedDiagram,
  type SerializedExport,
  type SerializedIndex,
  type SerializedTable,
} from './diagramSerializer';
import { createEmptyDiagram, type Diagram } from '../types/diagram';

function buildSerializedDiagram(overrides: Partial<SerializedDiagram> = {}): SerializedDiagram {
  return {
    id: 'diagram-1',
    name: 'Test Diagram',
    tables: [],
    relationships: [],
    uniqueConstraints: [],
    indexes: [],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function buildSerializedExport(
  overrides: Partial<SerializedExport> = {},
): SerializedExport {
  return {
    version: DIAGRAM_JSON_VERSION,
    diagram: buildSerializedDiagram(),
    ...overrides,
  };
}

function buildDiagramWithContent(): Diagram {
  const diagram = createEmptyDiagram('E-commerce Schema');
  diagram.tables.push({
    id: 'table-users',
    name: 'users',
    x: 100,
    y: 100,
    width: 240,
    height: 200,
    columns: [
      {
        id: 'col-users-id',
        name: 'id',
        dataType: 'serial',
        nullable: false,
        primaryKey: true,
      },
      {
        id: 'col-users-email',
        name: 'email',
        dataType: 'varchar',
        nullable: false,
        primaryKey: false,
      },
    ],
    indexes: [
      {
        id: 'idx-users-email',
        tableId: 'table-users',
        name: 'users_email_idx',
        columnIds: ['col-users-email'],
      },
    ],
  });
  diagram.tables.push({
    id: 'table-orders',
    name: 'orders',
    x: 450,
    y: 100,
    width: 240,
    height: 200,
    columns: [
      {
        id: 'col-orders-id',
        name: 'id',
        dataType: 'serial',
        nullable: false,
        primaryKey: true,
      },
      {
        id: 'col-orders-user-id',
        name: 'user_id',
        dataType: 'integer',
        nullable: false,
        primaryKey: false,
      },
    ],
    indexes: [
      {
        id: 'idx-orders-user-id',
        tableId: 'table-orders',
        name: 'orders_user_id_idx',
        columnIds: ['col-orders-user-id'],
      },
    ],
  });
  diagram.relationships.push({
    id: 'rel-orders-users',
    sourceTableId: 'table-orders',
    sourceColumnId: 'col-orders-user-id',
    targetTableId: 'table-users',
    targetColumnId: 'col-users-id',
    onDelete: 'cascade',
    onUpdate: 'no action',
  });
  return diagram;
}

describe('deserializeDiagram', () => {
  it('deserializes an empty diagram', () => {
    const payload = buildSerializedExport();
    const diagram = deserializeDiagram(payload);
    expect(diagram.id).toBe('diagram-1');
    expect(diagram.name).toBe('Test Diagram');
    expect(diagram.tables).toEqual([]);
    expect(diagram.relationships).toEqual([]);
  });

  it('deserializes a diagram with tables, columns and relationships', () => {
    const original = buildDiagramWithContent();
    const exportPayload = serializeDiagram(original);
    const diagram = deserializeDiagram(exportPayload);

    expect(diagram.id).toBe(original.id);
    expect(diagram.name).toBe(original.name);
    expect(diagram.tables).toHaveLength(2);
    expect(diagram.relationships).toHaveLength(1);

    const users = diagram.tables.find((t) => t.name === 'users')!;
    expect(users.columns).toHaveLength(2);
    expect(users.columns[0].name).toBe('id');
    expect(users.columns[0].dataType).toBe('serial');
    expect(users.columns[0].primaryKey).toBe(true);
    expect(users.columns[1].name).toBe('email');
    expect(users.columns[1].dataType).toBe('varchar');
    expect(users.columns[1].primaryKey).toBe(false);

    const orders = diagram.tables.find((t) => t.name === 'orders')!;
    expect(orders.columns).toHaveLength(2);
    expect(orders.columns.find((c) => c.name === 'user_id')!.dataType).toBe('integer');

    const rel = diagram.relationships[0];
    expect(rel.sourceTableId).toBe('table-orders');
    expect(rel.sourceColumnId).toBe('col-orders-user-id');
    expect(rel.targetTableId).toBe('table-users');
    expect(rel.targetColumnId).toBe('col-users-id');
  });

  it('round-trips through serialize then deserialize', () => {
    const original = buildDiagramWithContent();
    const serialized = serializeDiagram(original);
    const deserialized = deserializeDiagram(serialized);
    expect(deserialized).toEqual(original);
  });

  it('restores indexes from diagram-level indexes array onto tables', () => {
    const payload = buildSerializedExport({
      diagram: {
        ...buildSerializedDiagram(),
        tables: [
          {
            id: 'table-1',
            name: 'users',
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            columns: [
              {
                id: 'col-1',
                name: 'id',
                type: 'serial',
                length: null,
                nullable: false,
                primaryKey: true,
                unique: false,
                defaultValue: null,
                comment: null,
              },
            ],
          },
        ],
        relationships: [],
        uniqueConstraints: [],
        indexes: [
          {
            id: 'idx-1',
            tableId: 'table-1',
            columnIds: ['col-1'],
            unique: false,
            name: 'users_id_idx',
          },
        ],
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    });
    const diagram = deserializeDiagram(payload);
    expect(diagram.tables).toHaveLength(1);
    const table = diagram.tables[0];
    expect(table.indexes).toHaveLength(1);
    expect(table.indexes[0].id).toBe('idx-1');
    expect(table.indexes[0].name).toBe('users_id_idx');
    expect(table.indexes[0].columnIds).toEqual(['col-1']);
  });

  it('restores multiple indexes on the same table', () => {
    const payload = buildSerializedExport({
      diagram: {
        ...buildSerializedDiagram(),
        tables: [
          {
            id: 'table-1',
            name: 'users',
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            columns: [
              {
                id: 'col-1',
                name: 'id',
                type: 'serial',
                length: null,
                nullable: false,
                primaryKey: true,
                unique: false,
                defaultValue: null,
                comment: null,
              },
              {
                id: 'col-2',
                name: 'email',
                type: 'varchar',
                length: null,
                nullable: false,
                primaryKey: false,
                unique: false,
                defaultValue: null,
                comment: null,
              },
            ],
          },
        ],
        relationships: [],
        uniqueConstraints: [],
        indexes: [
          {
            id: 'idx-1',
            tableId: 'table-1',
            columnIds: ['col-1'],
            unique: true,
            name: 'users_id_idx',
          },
          {
            id: 'idx-2',
            tableId: 'table-1',
            columnIds: ['col-2'],
            unique: false,
            name: 'users_email_idx',
          },
        ],
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    });
    const diagram = deserializeDiagram(payload);
    const table = diagram.tables[0];
    expect(table.indexes).toHaveLength(2);
    expect(table.indexes.map((i) => i.name)).toEqual([
      'users_id_idx',
      'users_email_idx',
    ]);
    expect(table.indexes.map((i) => i.columnIds[0])).toEqual(['col-1', 'col-2']);
  });

  it('generates a synthetic name when serialized index name is null', () => {
    const payload = buildSerializedExport({
      diagram: {
        ...buildSerializedDiagram(),
        tables: [
          {
            id: 'table-1',
            name: 'users',
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            columns: [
              {
                id: 'col-1',
                name: 'id',
                type: 'serial',
                length: null,
                nullable: false,
                primaryKey: true,
                unique: false,
                defaultValue: null,
                comment: null,
              },
            ],
          },
        ],
        relationships: [],
        uniqueConstraints: [],
        indexes: [
          {
            id: 'idx-1',
            tableId: 'table-1',
            columnIds: ['col-1'],
            unique: false,
            name: null,
          },
        ],
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    });
    const diagram = deserializeDiagram(payload);
    expect(diagram.tables[0].indexes[0].name).toBe('idx_col-1');
  });

  it('leaves tables without indexes with an empty indexes array', () => {
    const payload = buildSerializedExport({
      diagram: {
        ...buildSerializedDiagram(),
        tables: [
          {
            id: 'table-1',
            name: 'users',
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            columns: [],
          },
        ],
        relationships: [],
        uniqueConstraints: [],
        indexes: [],
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    });
    const diagram = deserializeDiagram(payload);
    expect(diagram.tables[0].indexes).toEqual([]);
  });

  it('throws DiagramImportError for index missing required fields', () => {
    const payload = buildSerializedExport({
      diagram: {
        ...buildSerializedDiagram(),
        tables: [
          {
            id: 'table-1',
            name: 'users',
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            columns: [],
          },
        ],
        relationships: [],
        uniqueConstraints: [],
        indexes: [{ id: 'idx-1' } as unknown as SerializedIndex],
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    });
    expect(() => deserializeDiagram(payload)).toThrow(DiagramImportError);
    expect(() => deserializeDiagram(payload)).toThrow(
      /index is missing required fields/i,
    );
  });

  it('throws DiagramImportError for index with unexpected types', () => {
    const payload = buildSerializedExport({
      diagram: {
        ...buildSerializedDiagram(),
        tables: [
          {
            id: 'table-1',
            name: 'users',
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            columns: [],
          },
        ],
        relationships: [],
        uniqueConstraints: [],
        indexes: [
          {
            id: 123,
            tableId: 'table-1',
            columnIds: ['col-1'],
            unique: false,
            name: 'idx',
          } as unknown as SerializedIndex,
        ],
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    });
    expect(() => deserializeDiagram(payload)).toThrow(DiagramImportError);
    expect(() => deserializeDiagram(payload)).toThrow(
      /index has fields with unexpected types/i,
    );
  });

  it('handles tables with defaultValue null vs undefined', () => {
    const payload = buildSerializedExport({
      diagram: {
        ...buildSerializedDiagram(),
        tables: [
          {
            id: 'table-1',
            name: 'users',
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            columns: [
              {
                id: 'col-1',
                name: 'id',
                type: 'serial',
                length: null,
                nullable: false,
                primaryKey: true,
                unique: false,
                defaultValue: null,
                comment: null,
              },
              {
                id: 'col-2',
                name: 'created_at',
                type: 'timestamp',
                length: null,
                nullable: false,
                primaryKey: false,
                unique: false,
                defaultValue: 'CURRENT_TIMESTAMP',
                comment: null,
              },
            ],
          },
        ],
        relationships: [],
      },
    });
    const diagram = deserializeDiagram(payload);
    const idCol = diagram.tables[0].columns.find((c) => c.name === 'id')!;
    expect(idCol.defaultValue).toBeUndefined();
    const createdAtCol = diagram.tables[0].columns.find(
      (c) => c.name === 'created_at',
    )!;
    expect(createdAtCol.defaultValue).toBe('CURRENT_TIMESTAMP');
  });

  it('handles relationships with null column IDs', () => {
    const payload = buildSerializedExport({
      diagram: {
        ...buildSerializedDiagram(),
        tables: [
          { id: 't1', name: 'one', x: 0, y: 0, width: 100, height: 100, columns: [] },
          { id: 't2', name: 'two', x: 0, y: 0, width: 100, height: 100, columns: [] },
        ],
        relationships: [
          {
            id: 'rel-1',
            sourceTableId: 't2',
            sourceColumnId: null,
            targetTableId: 't1',
            targetColumnId: null,
            onDelete: 'no action',
            onUpdate: 'no action',
          },
        ],
      },
    });
    const diagram = deserializeDiagram(payload);
    expect(diagram.relationships).toHaveLength(1);
    const rel = diagram.relationships[0];
    expect(rel.sourceColumnId).toBeUndefined();
    expect(rel.targetColumnId).toBeUndefined();
  });

  it('throws DiagramImportError for unsupported version', () => {
    const payload = buildSerializedExport({
      version: '9.9.9',
    });
    expect(() => deserializeDiagram(payload)).toThrow(DiagramImportError);
    expect(() => deserializeDiagram(payload)).toThrow(
      /unsupported diagram file version/i,
    );
  });

  it('throws DiagramImportError for missing version', () => {
    const { version, ...payloadWithoutVersion } = buildSerializedExport();
    expect(() => deserializeDiagram(payloadWithoutVersion as unknown as SerializedExport)).toThrow(
      DiagramImportError,
    );
  });

  it('throws DiagramImportError for missing diagram root', () => {
    const payload = {
      version: DIAGRAM_JSON_VERSION,
    } as unknown as SerializedExport;
    expect(() => deserializeDiagram(payload)).toThrow(DiagramImportError);
    expect(() => deserializeDiagram(payload)).toThrow(
      /missing diagram root or required fields/i,
    );
  });

  it('throws DiagramImportError for table missing required fields', () => {
    const payload = buildSerializedExport({
      diagram: {
        ...buildSerializedDiagram(),
        tables: [
          { id: 't1', name: 'bad' } as unknown as SerializedTable,
        ],
      },
    });
    expect(() => deserializeDiagram(payload)).toThrow(DiagramImportError);
  });

  it('throws DiagramImportError for relationship missing required fields', () => {
    const payload = buildSerializedExport({
      diagram: {
        ...buildSerializedDiagram(),
        tables: [],
        relationships: [
          { id: 'rel-1' } as unknown as SerializedDiagram['relationships'][number],
        ],
      },
    });
    expect(() => deserializeDiagram(payload)).toThrow(DiagramImportError);
  });
});

describe('deserializeJson', () => {
  it('deserializes a valid parsed JSON value', () => {
    const original = buildDiagramWithContent();
    const serialized = serializeDiagram(original);
    const diagram = deserializeJson(serialized);
    expect(diagram).toEqual(original);
  });

  it('throws DiagramImportError for null', () => {
    expect(() => deserializeJson(null)).toThrow(DiagramImportError);
    expect(() => deserializeJson(null)).toThrow(
      /missing version or diagram root/i,
    );
  });

  it('throws DiagramImportError for a string', () => {
    expect(() => deserializeJson('not an object')).toThrow(DiagramImportError);
  });

  it('throws DiagramImportError for an object missing version and diagram', () => {
    expect(() => deserializeJson({ foo: 'bar' })).toThrow(DiagramImportError);
    expect(() => deserializeJson({ foo: 'bar' })).toThrow(
      /missing version or diagram root/i,
    );
  });
});
