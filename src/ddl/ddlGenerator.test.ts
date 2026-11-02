import { describe, it, expect } from 'vitest';
import { generateDDL } from './ddlGenerator';
import { createEmptyDiagram } from '../types/diagram';

function buildDiagram(): import('../types/diagram').Diagram {
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
  });
  diagram.relationships.push({
    id: 'rel-orders-users',
    sourceTableId: 'table-orders',
    sourceColumnId: 'col-orders-user-id',
    targetTableId: 'table-users',
    targetColumnId: 'col-users-id',
  });
  return diagram;
}

describe('generateDDL', () => {
  it('produces CREATE TABLE statements for all tables', () => {
    const ddl = generateDDL(buildDiagram());
    expect(ddl).toContain('CREATE TABLE "users"');
    expect(ddl).toContain('CREATE TABLE "orders"');
  });

  it('includes column definitions with types and nullability', () => {
    const ddl = generateDDL(buildDiagram());
    expect(ddl).toContain('"id" SERIAL NOT NULL');
    expect(ddl).toContain('"email" VARCHAR NOT NULL');
    expect(ddl).toContain('"created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP');
  });

  it('includes inline PRIMARY KEY for single-column keys', () => {
    const ddl = generateDDL(buildDiagram());
    // The users table has id as serial PK -> inline PRIMARY KEY
    const usersTable = ddl.split('CREATE TABLE "users" (')[1].split(')')[0];
    expect(usersTable).toContain('PRIMARY KEY');
  });

  it('produces FOREIGN KEY constraint from relationships', () => {
    const ddl = generateDDL(buildDiagram());
    expect(ddl).toContain('ADD CONSTRAINT');
    expect(ddl).toContain('FOREIGN KEY');
    expect(ddl).toContain('REFERENCES');
  });

  it('quotes all identifiers with double quotes', () => {
    const ddl = generateDDL(buildDiagram());
    expect(ddl).toContain('"users"');
    expect(ddl).toContain('"orders"');
    expect(ddl).toContain('"id"');
    expect(ddl).toContain('"email"');
  });

  it('contains no DROP, TRUNCATE or DELETE statements', () => {
    const ddl = generateDDL(buildDiagram());
    const upper = ddl.toUpperCase();
    expect(upper).not.toContain('DROP');
    expect(upper).not.toContain('TRUNCATE');
    expect(upper).not.toContain('DELETE');
  });

  it('returns empty string for an empty diagram', () => {
    const ddl = generateDDL(createEmptyDiagram());
    expect(ddl).toBe('');
  });

  it('throws for unsupported column types', () => {
    const diagram = createEmptyDiagram('Bad');
    diagram.tables.push({
      id: 'table-bad',
      name: 'bad_table',
      x: 0,
      y: 0,
      width: 200,
      height: 100,
      columns: [
        {
          id: 'col-bad-1',
          name: 'weird_col',
          dataType: 'unsupported_type' as any,
          nullable: true,
          primaryKey: false,
        },
      ],
    });
    expect(() => generateDDL(diagram)).toThrow(/Unsupported column type/);
  });

  it('produces deterministic output', () => {
    const diagram = buildDiagram();
    const ddl1 = generateDDL(diagram);
    const ddl2 = generateDDL(diagram);
    expect(ddl1).toBe(ddl2);
  });

  it('orders tables before constraints (tables-first)', () => {
    const ddl = generateDDL(buildDiagram());
    const firstCreateTable = ddl.indexOf('CREATE TABLE');
    const firstAlterTable = ddl.indexOf('ALTER TABLE');
    expect(firstCreateTable).toBeGreaterThanOrEqual(0);
    expect(firstAlterTable).toBeGreaterThan(firstCreateTable);
  });
});
