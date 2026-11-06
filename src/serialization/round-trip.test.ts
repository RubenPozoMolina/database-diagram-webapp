import { describe, it, expect } from 'vitest';
import { createEmptyDiagram, type Diagram } from '../types/diagram';
import { serializeDiagram } from './diagramSerializer';
import { deserializeJson } from './diagramDeserializer';

/**
 * Builds a schema-valid diagram exercising every structural field:
 * table position/size (layout), column length/unique/comment/defaultValue,
 * referential actions, composite unique constraints and indexes,
 * and multi-table relationships. Optional fields are only set when they
 * carry a meaningful value (null/absence is treated as "not set").
 */
function buildRichDiagram(): Diagram {
  const diagram = createEmptyDiagram('Round Trip Schema');
  diagram.id = 'diagram-round-trip';

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
        length: 255,
        nullable: false,
        primaryKey: false,
        unique: true,
        comment: 'User email address',
      },
      {
        id: 'col-users-bio',
        name: 'bio',
        dataType: 'text',
        nullable: true,
        primaryKey: false,
      },
    ],
    indexes: [
      { id: 'idx-users-email', tableId: 'table-users', name: 'users_email_idx', columnIds: ['col-users-email'] },
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
      {
        id: 'col-orders-total',
        name: 'total',
        dataType: 'numeric',
        nullable: false,
        primaryKey: false,
        defaultValue: '0.00',
      },
    ],
    indexes: [
      { id: 'idx-orders-user-id', tableId: 'table-orders', name: 'orders_user_id_idx', columnIds: ['col-orders-user-id'] },
    ],
  });

  diagram.relationships.push({
    id: 'rel-orders-users',
    sourceTableId: 'table-orders',
    sourceColumnId: 'col-orders-user-id',
    targetTableId: 'table-users',
    targetColumnId: 'col-users-id',
    onDelete: 'cascade',
    onUpdate: 'set null',
  });

  diagram.uniqueConstraints.push(
    { id: 'uc-users-email', tableId: 'table-users', columnIds: ['col-users-email'], name: 'users_email_key' },
    { id: 'uc-orders-composite', tableId: 'table-orders', columnIds: ['col-orders-user-id', 'col-orders-total'] },
  );

  return diagram;
}

describe('round-trip fidelity (export then re-import)', () => {
  it('produces an identical diagram in structure and layout', () => {
    const original = buildRichDiagram();

    // Export: serialize to JSON (the format a user downloads).
    const exportPayload = serializeDiagram(original);
    const json = JSON.stringify(exportPayload);

    // Re-import: parse the JSON and deserialize back into the model.
    const reparsed = JSON.parse(json) as unknown;
    const imported = deserializeJson(reparsed);

    // Structure: diagram identity and top-level fields.
    expect(imported.id).toBe(original.id);
    expect(imported.name).toBe(original.name);

    // Tables: count, name, position and size (layout).
    expect(imported.tables).toHaveLength(original.tables.length);
    for (const table of original.tables) {
      const importedTable = imported.tables.find((t) => t.id === table.id);
      expect(importedTable).toBeDefined();
      expect(importedTable!.name).toBe(table.name);
      expect(importedTable!.x).toBe(table.x);
      expect(importedTable!.y).toBe(table.y);
      expect(importedTable!.width).toBe(table.width);
      expect(importedTable!.height).toBe(table.height);
      expect(importedTable!.columns).toHaveLength(table.columns.length);

      // Columns: every structural field preserved.
      for (const column of table.columns) {
        const importedColumn = importedTable!.columns.find((c) => c.id === column.id);
        expect(importedColumn).toBeDefined();
        expect(importedColumn!.name).toBe(column.name);
        expect(importedColumn!.dataType).toBe(column.dataType);
        expect(importedColumn!.length).toBe(column.length);
        expect(importedColumn!.nullable).toBe(column.nullable);
        expect(importedColumn!.primaryKey).toBe(column.primaryKey);
        expect(importedColumn!.unique).toBe(column.unique);
        expect(importedColumn!.defaultValue).toBe(column.defaultValue);
        expect(importedColumn!.comment).toBe(column.comment);
      }
    }

    // Relationships: endpoints, column mapping and referential actions.
    expect(imported.relationships).toHaveLength(original.relationships.length);
    for (const rel of original.relationships) {
      const importedRel = imported.relationships.find((r) => r.id === rel.id);
      expect(importedRel).toBeDefined();
      expect(importedRel!.sourceTableId).toBe(rel.sourceTableId);
      expect(importedRel!.sourceColumnId).toBe(rel.sourceColumnId);
      expect(importedRel!.targetTableId).toBe(rel.targetTableId);
      expect(importedRel!.targetColumnId).toBe(rel.targetColumnId);
      expect(importedRel!.onDelete).toBe(rel.onDelete);
      expect(importedRel!.onUpdate).toBe(rel.onUpdate);
    }

    // Unique constraints: table, columns and name.
    expect(imported.uniqueConstraints).toHaveLength(original.uniqueConstraints.length);
    for (const uc of original.uniqueConstraints) {
      const importedUc = imported.uniqueConstraints.find((c) => c.id === uc.id);
      expect(importedUc).toBeDefined();
      expect(importedUc!.tableId).toBe(uc.tableId);
      expect(importedUc!.columnIds).toEqual(uc.columnIds);
      expect(importedUc!.name).toBe(uc.name);
    }

    // Indexes are redistributed onto their owning tables.
    for (const table of original.tables) {
      const importedTable = imported.tables.find((t) => t.id === table.id)!;
      expect(importedTable.indexes).toHaveLength(table.indexes.length);
      for (const index of table.indexes) {
        const importedIndex = importedTable.indexes.find((i) => i.id === index.id);
        expect(importedIndex).toBeDefined();
        expect(importedIndex!.tableId).toBe(index.tableId);
        expect(importedIndex!.columnIds).toEqual(index.columnIds);
        expect(importedIndex!.name).toBe(index.name);
      }
    }
  });

  it('serializes to valid, credential-free JSON that can be re-parsed', () => {
    const original = buildRichDiagram();
    const exportPayload = serializeDiagram(original);
    const json = JSON.stringify(exportPayload);

    // Valid JSON.
    expect(() => JSON.parse(json)).not.toThrow();

    // No database credentials leak into the export.
    const lower = json.toLowerCase();
    for (const field of ['host', 'port', 'database', '"user"', 'password']) {
      expect(lower).not.toContain(field);
    }

    // Re-parsing yields a schema-valid payload the deserializer accepts.
    const imported = deserializeJson(JSON.parse(json));
    expect(imported.name).toBe('Round Trip Schema');
    expect(imported.tables).toHaveLength(2);
  });
});
