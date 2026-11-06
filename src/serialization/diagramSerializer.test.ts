import { describe, it, expect } from 'vitest';
import { createEmptyDiagram } from '../types/diagram';
import {
  CREDENTIAL_FIELDS,
  DIAGRAM_JSON_VERSION,
  serializeDiagram,
  stripCredentials,
  type SerializedExport,
} from './diagramSerializer';

const buildDiagram = (): import('../types/diagram').Diagram => {
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
      {
        id: 'col-users-created-at',
        name: 'created_at',
        dataType: 'timestamp',
        nullable: false,
        primaryKey: false,
        defaultValue: 'CURRENT_TIMESTAMP',
      },
    ],
    indexes: [],
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
    indexes: [],
  });
  diagram.relationships.push({
    id: 'rel-orders-users',
    sourceTableId: 'table-orders',
    sourceColumnId: 'col-orders-user-id',
    targetTableId: 'table-users',
    targetColumnId: 'col-users-id',
  });
  return diagram;
};

describe('serializeDiagram', () => {
  it('produces a payload with the schema version and diagram root', () => {
    const result = serializeDiagram(createEmptyDiagram());
    expect(result.version).toBe(DIAGRAM_JSON_VERSION);
    expect(result.diagram).toBeDefined();
  });

  it('includes the diagram id and name', () => {
    const diagram = createEmptyDiagram('My Diagram');
    const result = serializeDiagram(diagram);
    expect(result.diagram.id).toBe(diagram.id);
    expect(result.diagram.name).toBe('My Diagram');
  });

  it('serializes all tables with position and size', () => {
    const diagram = buildDiagram();
    const result = serializeDiagram(diagram);
    expect(result.diagram.tables).toHaveLength(2);
    const users = result.diagram.tables.find((t) => t.name === 'users');
    expect(users).toBeDefined();
    expect(users!.x).toBe(100);
    expect(users!.y).toBe(100);
    expect(users!.width).toBe(240);
    expect(users!.height).toBe(200);
  });

  it('serializes all columns with data types and keys', () => {
    const diagram = buildDiagram();
    const result = serializeDiagram(diagram);
    const users = result.diagram.tables.find((t) => t.name === 'users')!;
    expect(users.columns).toHaveLength(3);
    const idCol = users.columns.find((c) => c.name === 'id')!;
    expect(idCol.type).toBe('serial');
    expect(idCol.primaryKey).toBe(true);
    expect(idCol.nullable).toBe(false);
    const emailCol = users.columns.find((c) => c.name === 'email')!;
    expect(emailCol.type).toBe('varchar');
    expect(emailCol.primaryKey).toBe(false);
    const createdAtCol = users.columns.find((c) => c.name === 'created_at')!;
    expect(createdAtCol.type).toBe('timestamp');
    expect(createdAtCol.defaultValue).toBe('CURRENT_TIMESTAMP');
  });

  it('serializes column length for character-based types', () => {
    const diagram = createEmptyDiagram('With Lengths');
    diagram.tables.push({
      id: 'table-users',
      name: 'users',
      x: 100,
      y: 100,
      width: 240,
      height: 200,
      columns: [
        { id: 'col-users-id', name: 'id', dataType: 'serial', nullable: false, primaryKey: true },
        { id: 'col-users-email', name: 'email', dataType: 'varchar', nullable: false, primaryKey: false, length: 255 },
        { id: 'col-users-bio', name: 'bio', dataType: 'text', nullable: true, primaryKey: false, length: null },
      ],
      indexes: [],
    });

    const result = serializeDiagram(diagram);
    const users = result.diagram.tables.find((t) => t.name === 'users')!;
    const emailCol = users.columns.find((c) => c.name === 'email')!;
    expect(emailCol.length).toBe(255);
    const bioCol = users.columns.find((c) => c.name === 'bio')!;
    expect(bioCol.length).toBeNull();
    const idCol = users.columns.find((c) => c.name === 'id')!;
    expect(idCol.length).toBeNull();
  });

  it('serializes column unique flag', () => {
    const diagram = createEmptyDiagram('With Unique');
    diagram.tables.push({
      id: 'table-users',
      name: 'users',
      x: 100,
      y: 100,
      width: 240,
      height: 200,
      columns: [
        { id: 'col-users-id', name: 'id', dataType: 'serial', nullable: false, primaryKey: true },
        { id: 'col-users-email', name: 'email', dataType: 'varchar', nullable: false, primaryKey: false, unique: true },
        { id: 'col-users-name', name: 'name', dataType: 'text', nullable: true, primaryKey: false, unique: false },
      ],
      indexes: [],
    });

    const result = serializeDiagram(diagram);
    const users = result.diagram.tables.find((t) => t.name === 'users')!;
    const emailCol = users.columns.find((c) => c.name === 'email')!;
    expect(emailCol.unique).toBe(true);
    const nameCol = users.columns.find((c) => c.name === 'name')!;
    expect(nameCol.unique).toBe(false);
  });

  it('serializes column comment', () => {
    const diagram = createEmptyDiagram('With Comments');
    diagram.tables.push({
      id: 'table-users',
      name: 'users',
      x: 100,
      y: 100,
      width: 240,
      height: 200,
      columns: [
        { id: 'col-users-id', name: 'id', dataType: 'serial', nullable: false, primaryKey: true },
        { id: 'col-users-email', name: 'email', dataType: 'varchar', nullable: false, primaryKey: false, comment: 'User email address' },
        { id: 'col-users-name', name: 'name', dataType: 'text', nullable: true, primaryKey: false, comment: null },
      ],
      indexes: [],
    });

    const result = serializeDiagram(diagram);
    const users = result.diagram.tables.find((t) => t.name === 'users')!;
    const emailCol = users.columns.find((c) => c.name === 'email')!;
    expect(emailCol.comment).toBe('User email address');
    const nameCol = users.columns.find((c) => c.name === 'name')!;
    expect(nameCol.comment).toBeNull();
  });

  it('serializes all relationships between tables', () => {
    const diagram = buildDiagram();
    const result = serializeDiagram(diagram);
    expect(result.diagram.relationships).toHaveLength(1);
    const rel = result.diagram.relationships[0];
    expect(rel.sourceTableId).toBe('table-orders');
    expect(rel.sourceColumnId).toBe('col-orders-user-id');
    expect(rel.targetTableId).toBe('table-users');
    expect(rel.targetColumnId).toBe('col-users-id');
    expect(rel.onDelete).toBe('no action');
    expect(rel.onUpdate).toBe('no action');
  });

  it('serializes custom referential actions from the model', () => {
    const diagram = buildDiagram();
    diagram.relationships[0].onDelete = 'cascade';
    diagram.relationships[0].onUpdate = 'set null';

    const result = serializeDiagram(diagram);
    const rel = result.diagram.relationships[0];
    expect(rel.onDelete).toBe('cascade');
    expect(rel.onUpdate).toBe('set null');
  });

  it('serializes indexes from all tables', () => {
    const diagram = createEmptyDiagram('With Indexes');
    diagram.tables.push({
      id: 'table-users',
      name: 'users',
      x: 100,
      y: 100,
      width: 240,
      height: 200,
      columns: [
        { id: 'col-users-id', name: 'id', dataType: 'serial', nullable: false, primaryKey: true },
        { id: 'col-users-email', name: 'email', dataType: 'varchar', nullable: false, primaryKey: false },
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
        { id: 'col-orders-id', name: 'id', dataType: 'serial', nullable: false, primaryKey: true },
        { id: 'col-orders-user-id', name: 'user_id', dataType: 'integer', nullable: false, primaryKey: false },
      ],
      indexes: [
        { id: 'idx-orders-user-id', tableId: 'table-orders', name: 'orders_user_id_idx', columnIds: ['col-orders-user-id'] },
      ],
    });

    const result = serializeDiagram(diagram);
    expect(result.diagram.indexes).toHaveLength(2);

    const usersIdx = result.diagram.indexes.find((i) => i.name === 'users_email_idx');
    expect(usersIdx).toBeDefined();
    expect(usersIdx!.tableId).toBe('table-users');
    expect(usersIdx!.columnIds).toEqual(['col-users-email']);
    expect(usersIdx!.unique).toBe(false);
    expect(usersIdx!.name).toBe('users_email_idx');

    const ordersIdx = result.diagram.indexes.find((i) => i.name === 'orders_user_id_idx');
    expect(ordersIdx).toBeDefined();
    expect(ordersIdx!.tableId).toBe('table-orders');
    expect(ordersIdx!.columnIds).toEqual(['col-orders-user-id']);
  });

  it('serializes unique constraints from the diagram', () => {
    const diagram = createEmptyDiagram('With Constraints');
    diagram.uniqueConstraints.push(
      { id: 'uc-1', tableId: 'table-users', columnIds: ['col-users-email'], name: 'users_email_key' },
      { id: 'uc-2', tableId: 'table-orders', columnIds: ['col-orders-user-id', 'col-orders-total'] },
    );

    const result = serializeDiagram(diagram);
    expect(result.diagram.uniqueConstraints).toHaveLength(2);

    const usersConstraint = result.diagram.uniqueConstraints.find(
      (c) => c.id === 'uc-1',
    );
    expect(usersConstraint).toBeDefined();
    expect(usersConstraint!.tableId).toBe('table-users');
    expect(usersConstraint!.columnIds).toEqual(['col-users-email']);
    expect(usersConstraint!.name).toBe('users_email_key');

    const ordersConstraint = result.diagram.uniqueConstraints.find(
      (c) => c.id === 'uc-2',
    );
    expect(ordersConstraint).toBeDefined();
    expect(ordersConstraint!.tableId).toBe('table-orders');
    expect(ordersConstraint!.columnIds).toEqual(['col-orders-user-id', 'col-orders-total']);
    expect(ordersConstraint!.name).toBeNull();
  });

  it('includes empty constraints and indexes arrays', () => {
    const result = serializeDiagram(createEmptyDiagram());
    expect(result.diagram.uniqueConstraints).toEqual([]);
    expect(result.diagram.indexes).toEqual([]);
  });

  it('includes creation and update timestamps in ISO 8601 format', () => {
    const result = serializeDiagram(createEmptyDiagram());
    expect(result.diagram.createdAt).toMatch(/\d{4}-\d{2}-\d{2}T/);
    expect(result.diagram.updatedAt).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  it('produces JSON that round-trips through JSON.stringify/parse', () => {
    const diagram = buildDiagram();
    const result = serializeDiagram(diagram);
    const json = JSON.stringify(result);
    const parsed = JSON.parse(json) as SerializedExport;
    expect(parsed.version).toBe(DIAGRAM_JSON_VERSION);
    expect(parsed.diagram.tables).toHaveLength(2);
    expect(parsed.diagram.relationships).toHaveLength(1);
  });

  it('contains no database credentials (host, port, database, user, password)', () => {
    const diagram = buildDiagram();
    const result = serializeDiagram(diagram);
    const serialized = JSON.stringify(result).toLowerCase();
    for (const credential of [
      'host',
      'port',
      'database',
      '"user"',
      'password',
    ]) {
      expect(serialized).not.toContain(credential);
    }
  });

  it('stripCredentials removes credential fields from nested objects', () => {
    const dirty = {
      version: '1.0.0',
      diagram: {
        id: 'abc',
        name: 'My Diagram',
        host: 'db.example.com',
        port: 5432,
        database: 'mydb',
        user: 'app_user',
        password: 's3cret',
        tables: [
          {
            id: 't1',
            name: 'accounts',
            host: 'injected-host',
            columns: [{ id: 'c1', name: 'id', password: 'leaked-pw' }],
          },
        ],
      },
    };
    const cleaned = stripCredentials(dirty);
    const serialized = JSON.stringify(cleaned).toLowerCase();
    for (const field of CREDENTIAL_FIELDS) {
      expect(serialized).not.toContain(field);
    }
    // Non-credential data is preserved.
    expect(cleaned).toMatchObject({
      version: '1.0.0',
      diagram: { id: 'abc', name: 'My Diagram' },
    });
  });

  it('stripCredentials preserves arrays of non-credential objects', () => {
    const dirty = {
      items: [
        { name: 'table-a', host: 'bad' },
        { name: 'table-b', password: 'bad' },
      ],
    };
    const cleaned = stripCredentials(dirty);
    expect(cleaned).toEqual({
      items: [{ name: 'table-a' }, { name: 'table-b' }],
    });
  });

  it('serializeDiagram strips credentials even if injected into the diagram', () => {
    const diagram = createEmptyDiagram('Tainted Diagram');
    // Simulate a future model extension that mistakenly carries credentials.
    (diagram as Record<string, unknown>).host = 'db.example.com';
    (diagram as Record<string, unknown>).password = 's3cret';
    const result = serializeDiagram(diagram);
    const serialized = JSON.stringify(result).toLowerCase();
    for (const field of CREDENTIAL_FIELDS) {
      expect(serialized).not.toContain(field);
    }
    expect(result.diagram.name).toBe('Tainted Diagram');
  });

  it('serializes an empty diagram to valid well-formed JSON', () => {
    const result = serializeDiagram(createEmptyDiagram());
    expect(() => JSON.stringify(result)).not.toThrow();
    expect(result.diagram.tables).toEqual([]);
    expect(result.diagram.relationships).toEqual([]);
  });
});
