/**
 * Unit tests for the diagram data model (src/types/diagram.ts).
 *
 * Locks in the TASK-005 data model contract:
 *  - AC1: the Table model stores a name and a list of columns
 *  - AC2: the Column model stores name, data type, nullable and default value
 *  - the Diagram model holds tables and relationships between tables
 *
 * AC3 (table model connected to canvas rendering) is covered by
 * src/components/DiagramCanvas.test.tsx, which renders tables with their
 * column lists straight from this model.
 */

import { describe, it, expect } from 'vitest';
import {
  createColumn,
  createEmptyDiagram,
  createTable,
  findTableById,
  findRelationshipById,
  type Column,
  type Diagram,
  type Relationship,
  type Table,
} from '../types/diagram';

function makeColumn(overrides: Partial<Column> = {}): Column {
  return {
    id: 'col-1',
    name: 'id',
    dataType: 'integer',
    nullable: false,
    primaryKey: true,
    defaultValue: undefined,
    ...overrides,
  };
}

function makeTable(overrides: Partial<Table> = {}): Table {
  return {
    id: 'table-1',
    name: 'users',
    x: 100,
    y: 100,
    width: 240,
    height: 200,
    columns: [makeColumn()],
    ...overrides,
  };
}

describe('Diagram data model (TASK-005)', () => {
  describe('Table model (AC1: stores name and list of columns)', () => {
    it('stores a name and a list of columns', () => {
      const table: Table = makeTable({ name: 'orders' });

      expect(table.name).toBe('orders');
      expect(table.columns).toHaveLength(1);
      expect(table.columns[0]).toEqual(
        expect.objectContaining({ name: 'id', dataType: 'integer' }),
      );
    });

    it('can hold many columns on a single table', () => {
      const table: Table = makeTable({
        name: 'orders',
        columns: [
          makeColumn({ name: 'id', dataType: 'integer', nullable: false }),
          makeColumn({ name: 'user_id', dataType: 'integer', nullable: false }),
          makeColumn({ name: 'total', dataType: 'numeric', nullable: true }),
        ],
      });

      expect(table.name).toBe('orders');
      expect(table.columns).toHaveLength(3);
      expect(table.columns.map((column) => column.name)).toEqual([
        'id',
        'user_id',
        'total',
      ]);
    });

    it('createEmptyDiagram produces a diagram with no tables or relationships', () => {
      const diagram: Diagram = createEmptyDiagram('New Diagram');

      expect(diagram.id).toBeDefined();
      expect(diagram.name).toBe('New Diagram');
      expect(diagram.tables).toEqual([]);
      expect(diagram.relationships).toEqual([]);
    });

    it('findTableById returns the matching table or undefined', () => {
      const diagram: Diagram = {
        ...createEmptyDiagram(),
        tables: [makeTable(), makeTable({ id: 'table-2', name: 'orders' })],
      };

      expect(findTableById(diagram, 'table-1')!.name).toBe('users');
      expect(findTableById(diagram, 'table-2')!.name).toBe('orders');
      expect(findTableById(diagram, 'missing')).toBeUndefined();
    });
  });

  describe('Column model (AC2: name, data type, nullable, default value)', () => {
    it('stores name, data type, nullable and default value', () => {
      const column: Column = makeColumn({
        name: 'email',
        dataType: 'varchar',
        nullable: false,
      });

      expect(column.name).toBe('email');
      expect(column.dataType).toBe('varchar');
      expect(column.nullable).toBe(false);
      expect(column.defaultValue).toBeUndefined();
    });

    it('default value is optional and can hold a SQL expression', () => {
      const withDefault: Column = makeColumn({
        name: 'created_at',
        dataType: 'timestamp',
        nullable: false,
        defaultValue: 'CURRENT_TIMESTAMP',
      });
      expect(withDefault.defaultValue).toBe('CURRENT_TIMESTAMP');

      const withoutDefault: Column = makeColumn();
      expect(withoutDefault.defaultValue).toBeUndefined();
    });

    it('supports nullable columns with no default', () => {
      const column: Column = makeColumn({
        name: 'notes',
        dataType: 'text',
        nullable: true,
      });

      expect(column.nullable).toBe(true);
      expect(column.defaultValue).toBeUndefined();
    });
  });

  describe('Relationships between tables', () => {
    it('connects two tables by id, optionally mapping columns', () => {
      const relationship: Relationship = {
        id: 'rel-1',
        sourceTableId: 'table-1',
        sourceColumnId: 'col-2',
        targetTableId: 'table-2',
        targetColumnId: 'col-1',
      };

      expect(relationship.sourceTableId).toBe('table-1');
      expect(relationship.sourceColumnId).toBe('col-2');
      expect(relationship.targetTableId).toBe('table-2');
      expect(relationship.targetColumnId).toBe('col-1');
    });

    it('findRelationshipById returns the matching relationship or undefined', () => {
      const diagram: Diagram = {
        ...createEmptyDiagram(),
        relationships: [
          { id: 'rel-1', sourceTableId: 't1', targetTableId: 't2' },
        ],
      };

      expect(findRelationshipById(diagram, 'rel-1')!.id).toBe('rel-1');
      expect(findRelationshipById(diagram, 'missing')).toBeUndefined();
    });
  });

  describe('createColumn factory (TASK-005)', () => {
    it('creates a column with all required fields', () => {
      const column = createColumn(
        'col-1',
        'email',
        'varchar',
        false,
        undefined,
        false,
      );

      expect(column.id).toBe('col-1');
      expect(column.name).toBe('email');
      expect(column.dataType).toBe('varchar');
      expect(column.nullable).toBe(false);
      expect(column.primaryKey).toBe(false);
    });

    it('creates a column with an optional default value', () => {
      const column = createColumn(
        'col-2',
        'created_at',
        'timestamp',
        false,
        'CURRENT_TIMESTAMP',
        false,
      );

      expect(column.defaultValue).toBe('CURRENT_TIMESTAMP');
    });

    it('creates a nullable column without a default value', () => {
      const column = createColumn('col-3', 'notes', 'text', true);

      expect(column.nullable).toBe(true);
      expect(column.defaultValue).toBeUndefined();
    });
  });

  describe('createTable factory (TASK-005)', () => {
    it('creates a table with name and empty column list', () => {
      const table = createTable(
        'table-1',
        'users',
        100,
        100,
        240,
        200,
      );

      expect(table.id).toBe('table-1');
      expect(table.name).toBe('users');
      expect(table.x).toBe(100);
      expect(table.y).toBe(100);
      expect(table.width).toBe(240);
      expect(table.height).toBe(200);
      expect(table.columns).toEqual([]);
    });

    it('creates a table with columns', () => {
      const columns = [
        createColumn('col-1', 'id', 'integer', false, undefined, true),
        createColumn('col-2', 'name', 'varchar', false),
      ];
      const table = createTable(
        'table-1',
        'users',
        0,
        0,
        220,
        120,
        columns,
      );

      expect(table.columns).toHaveLength(2);
      expect(table.columns[0].name).toBe('id');
      expect(table.columns[0].dataType).toBe('integer');
      expect(table.columns[1].name).toBe('name');
      expect(table.columns[1].dataType).toBe('varchar');
    });
  });
});
