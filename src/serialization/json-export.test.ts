/**
 * Unit tests for JSON export.
 *
 * Verifies that the diagram export payload produced by serializeDiagram()
 * is valid JSON, contains the complete diagram model, and contains no
 * database credentials (host, port, database, user, password).
 *
 * These tests map directly to TASK-028 acceptance criteria:
 *   AC1: Unit tests verify JSON export is valid JSON
 *   AC2: Unit tests verify JSON contains complete diagram model
 *   AC3: Unit tests verify JSON contains no credentials
 */

import { describe, it, expect } from 'vitest';
import type { Column, Diagram } from '../types/diagram';
import { createEmptyDiagram } from '../types/diagram';
import {
  CREDENTIAL_FIELDS,
  DIAGRAM_JSON_VERSION,
  serializeDiagram,
  type SerializedExport,
} from './diagramSerializer';

/** Builds a rich diagram with tables, columns, relationships, constraints and indexes. */
function buildRichDiagram(): Diagram {
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
        length: 255,
        unique: true,
        comment: 'User email address',
      },
      {
        id: 'col-users-created-at',
        name: 'created_at',
        dataType: 'timestamp',
        nullable: false,
        primaryKey: false,
        defaultValue: 'CURRENT_TIMESTAMP',
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
  );
  return diagram;
}

/** Returns true if the given value can be JSON.stringified and re-parsed without throwing. */
function isValidJson(value: unknown): boolean {
  try {
    JSON.parse(JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/** Recursively checks that none of the credential field names appear as keys anywhere in the object. */
function containsNoCredentialFields(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.every(containsNoCredentialFields);
  }
  if (value !== null && typeof value === 'object') {
    for (const key of Object.keys(value)) {
      if (CREDENTIAL_FIELDS.has(key.toLowerCase())) {
        return false;
      }
      if (!containsNoCredentialFields((value as Record<string, unknown>)[key])) {
        return false;
      }
    }
  }
  return true;
}

describe('JSON export — AC1: valid JSON', () => {
  it('produces a payload that serializes to valid JSON', () => {
    const result = serializeDiagram(buildRichDiagram());
    expect(isValidJson(result)).toBe(true);
  });

  it('produces a payload whose JSON string can be round-tripped through JSON.parse', () => {
    const result = serializeDiagram(buildRichDiagram());
    const json = JSON.stringify(result);
    expect(() => JSON.parse(json)).not.toThrow();
    const parsed = JSON.parse(json) as SerializedExport;
    expect(parsed.version).toBe(DIAGRAM_JSON_VERSION);
  });

  it('produces valid JSON for an empty diagram', () => {
    const result = serializeDiagram(createEmptyDiagram());
    expect(isValidJson(result)).toBe(true);
    expect(JSON.parse(JSON.stringify(result))).toBeDefined();
  });

  it('has a top-level version field equal to the schema version', () => {
    const result = serializeDiagram(createEmptyDiagram());
    const parsed = JSON.parse(JSON.stringify(result)) as SerializedExport;
    expect(parsed.version).toBe(DIAGRAM_JSON_VERSION);
    expect(typeof parsed.version).toBe('string');
  });

  it('has a top-level diagram root object', () => {
    const result = serializeDiagram(createEmptyDiagram());
    const parsed = JSON.parse(JSON.stringify(result)) as SerializedExport;
    expect(parsed.diagram).toBeDefined();
    expect(typeof parsed.diagram).toBe('object');
  });
});

describe('JSON export — AC2: complete diagram model', () => {
  it('includes the diagram id and name', () => {
    const diagram = createEmptyDiagram('My Diagram');
    const result = serializeDiagram(diagram);
    const parsed = JSON.parse(JSON.stringify(result)) as SerializedExport;
    expect(parsed.diagram.id).toBe(diagram.id);
    expect(parsed.diagram.name).toBe('My Diagram');
  });

  it('includes all tables with position and size', () => {
    const diagram = buildRichDiagram();
    const result = serializeDiagram(diagram);
    const parsed = JSON.parse(JSON.stringify(result)) as SerializedExport;
    expect(parsed.diagram.tables).toHaveLength(2);

    const users = parsed.diagram.tables.find((t) => t.name === 'users');
    expect(users).toBeDefined();
    expect(users!.x).toBe(100);
    expect(users!.y).toBe(100);
    expect(users!.width).toBe(240);
    expect(users!.height).toBe(200);

    const orders = parsed.diagram.tables.find((t) => t.name === 'orders');
    expect(orders).toBeDefined();
    expect(orders!.x).toBe(450);
    expect(orders!.y).toBe(100);
  });

  it('includes all columns with data types and keys', () => {
    const diagram = buildRichDiagram();
    const result = serializeDiagram(diagram);
    const parsed = JSON.parse(JSON.stringify(result)) as SerializedExport;

    const users = parsed.diagram.tables.find((t) => t.name === 'users')!;
    expect(users.columns).toHaveLength(3);

    const idCol = users.columns.find((c) => c.name === 'id')!;
    expect(idCol.type).toBe('serial');
    expect(idCol.primaryKey).toBe(true);
    expect(idCol.nullable).toBe(false);

    const emailCol = users.columns.find((c) => c.name === 'email')!;
    expect(emailCol.type).toBe('varchar');
    expect(emailCol.primaryKey).toBe(false);
    expect(emailCol.length).toBe(255);
    expect(emailCol.unique).toBe(true);
    expect(emailCol.comment).toBe('User email address');

    const orders = parsed.diagram.tables.find((t) => t.name === 'orders')!;
    const totalCol = orders.columns.find((c) => c.name === 'total')!;
    expect(totalCol.type).toBe('numeric');
    expect(totalCol.defaultValue).toBe('0.00');
  });

  it('includes all relationships between tables', () => {
    const diagram = buildRichDiagram();
    const result = serializeDiagram(diagram);
    const parsed = JSON.parse(JSON.stringify(result)) as SerializedExport;
    expect(parsed.diagram.relationships).toHaveLength(1);

    const rel = parsed.diagram.relationships[0];
    expect(rel.sourceTableId).toBe('table-orders');
    expect(rel.sourceColumnId).toBe('col-orders-user-id');
    expect(rel.targetTableId).toBe('table-users');
    expect(rel.targetColumnId).toBe('col-users-id');
    expect(rel.onDelete).toBe('cascade');
    expect(rel.onUpdate).toBe('set null');
  });

  it('includes all unique constraints', () => {
    const diagram = buildRichDiagram();
    const result = serializeDiagram(diagram);
    const parsed = JSON.parse(JSON.stringify(result)) as SerializedExport;
    expect(parsed.diagram.uniqueConstraints).toHaveLength(1);

    const uc = parsed.diagram.uniqueConstraints[0];
    expect(uc.tableId).toBe('table-users');
    expect(uc.columnIds).toEqual(['col-users-email']);
    expect(uc.name).toBe('users_email_key');
  });

  it('includes all indexes from all tables', () => {
    const diagram = buildRichDiagram();
    const result = serializeDiagram(diagram);
    const parsed = JSON.parse(JSON.stringify(result)) as SerializedExport;
    expect(parsed.diagram.indexes).toHaveLength(2);

    const usersIdx = parsed.diagram.indexes.find((i) => i.name === 'users_email_idx');
    expect(usersIdx).toBeDefined();
    expect(usersIdx!.tableId).toBe('table-users');
    expect(usersIdx!.columnIds).toEqual(['col-users-email']);

    const ordersIdx = parsed.diagram.indexes.find((i) => i.name === 'orders_user_id_idx');
    expect(ordersIdx).toBeDefined();
    expect(ordersIdx!.tableId).toBe('table-orders');
    expect(ordersIdx!.columnIds).toEqual(['col-orders-user-id']);
  });

  it('includes creation and update timestamps in ISO 8601 format', () => {
    const result = serializeDiagram(createEmptyDiagram());
    const parsed = JSON.parse(JSON.stringify(result)) as SerializedExport;
    expect(parsed.diagram.createdAt).toMatch(/\d{4}-\d{2}-\d{2}T/);
    expect(parsed.diagram.updatedAt).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  it('includes empty arrays for constraints and indexes on an empty diagram', () => {
    const result = serializeDiagram(createEmptyDiagram());
    const parsed = JSON.parse(JSON.stringify(result)) as SerializedExport;
    expect(parsed.diagram.uniqueConstraints).toEqual([]);
    expect(parsed.diagram.indexes).toEqual([]);
    expect(parsed.diagram.tables).toEqual([]);
    expect(parsed.diagram.relationships).toEqual([]);
  });
});

describe('JSON export — AC3: no credentials', () => {
  it('contains no credential fields in the serialized payload', () => {
    const result = serializeDiagram(buildRichDiagram());
    expect(containsNoCredentialFields(result)).toBe(true);
  });

  it('contains no credential field names in the JSON string', () => {
    const result = serializeDiagram(buildRichDiagram());
    const serialized = JSON.stringify(result).toLowerCase();
    for (const field of ['host', 'port', 'database', '"user"', 'password']) {
      expect(serialized).not.toContain(field);
    }
  });

  it('strips injected credentials from the diagram object itself', () => {
    const diagram = createEmptyDiagram('Tainted Diagram');
    (diagram as Record<string, unknown>).host = 'db.example.com';
    (diagram as Record<string, unknown>).port = 5432;
    (diagram as Record<string, unknown>).database = 'mydb';
    (diagram as Record<string, unknown>).user = 'app_user';
    (diagram as Record<string, unknown>).password = 's3cret';

    const result = serializeDiagram(diagram);
    const serialized = JSON.stringify(result).toLowerCase();
    for (const field of CREDENTIAL_FIELDS) {
      expect(serialized).not.toContain(field);
    }
    // Non-credential data is preserved.
    expect(result.diagram.name).toBe('Tainted Diagram');
  });

  it('does not leak credentials nested inside tables or columns', () => {
    const diagram = createEmptyDiagram('With Injected Fields');
    diagram.tables.push({
      id: 'table-tainted',
      name: 'tainted',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      columns: [
        { id: 'col-1', name: 'id', dataType: 'serial', nullable: false, primaryKey: true, host: 'injected-host' } as unknown as Column,
        { id: 'col-2', name: 'secret', dataType: 'text', nullable: true, primaryKey: false, password: 'leaked-pw' } as unknown as Column,
      ],
      indexes: [],
    });

    const result = serializeDiagram(diagram);
    expect(containsNoCredentialFields(result)).toBe(true);

    const serialized = JSON.stringify(result).toLowerCase();
    for (const field of ['host', 'password', 'database', 'user', 'port']) {
      expect(serialized).not.toContain(field);
    }
  });
});
