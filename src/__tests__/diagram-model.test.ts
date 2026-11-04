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
  createRelationship,
  createTable,
  findPrimaryKeyColumn,
  findPrimaryKeyColumns,
  findRelationshipById,
  findRelationshipsByTable,
  findTableById,
  hasPrimaryKey,
  setPrimaryKeyColumn,
  togglePrimaryKeyColumn,
  type Column,
  type Diagram,
  type Relationship,
  type Table,
  validatePrimaryKeyUniqueness,
} from '../types/diagram';
import { deserializeDiagram } from '../serialization/diagramDeserializer';
import { serializeDiagram } from '../serialization/diagramSerializer';

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
    indexes: [],
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

  describe('createRelationship factory (STORY-005 / TASK-014)', () => {
    it('creates a relationship with column-to-column mapping', () => {
      const relationship = createRelationship(
        'rel-1',
        'table-1',
        'col-2',
        'table-2',
        'col-1',
      );

      expect(relationship.id).toBe('rel-1');
      expect(relationship.sourceTableId).toBe('table-1');
      expect(relationship.sourceColumnId).toBe('col-2');
      expect(relationship.targetTableId).toBe('table-2');
      expect(relationship.targetColumnId).toBe('col-1');
    });

    it('creates a relationship without column mapping when column ids are undefined', () => {
      const relationship = createRelationship(
        'rel-2',
        'table-1',
        undefined,
        'table-2',
        undefined,
      );

      expect(relationship.sourceColumnId).toBeUndefined();
      expect(relationship.targetColumnId).toBeUndefined();
    });
  });

  describe('findRelationshipsByTable', () => {
    it('returns relationships where the table is source or target', () => {
      const diagram: Diagram = {
        ...createEmptyDiagram(),
        tables: [
          { id: 't1', name: 'users', x: 0, y: 0, width: 220, height: 120, columns: [], indexes: [] },
          { id: 't2', name: 'orders', x: 0, y: 0, width: 220, height: 120, columns: [], indexes: [] },
          { id: 't3', name: 'products', x: 0, y: 0, width: 220, height: 120, columns: [], indexes: [] },
        ],
        relationships: [
          createRelationship('r1', 't1', 'c1', 't2', 'c2'),
          createRelationship('r2', 't3', 'c3', 't1', 'c4'),
          createRelationship('r3', 't2', 'c5', 't3', 'c6'),
        ],
      };

      expect(findRelationshipsByTable(diagram, 't1')).toHaveLength(2);
      expect(findRelationshipsByTable(diagram, 't2')).toHaveLength(2);
      expect(findRelationshipsByTable(diagram, 't3')).toHaveLength(2);
      expect(findRelationshipsByTable(diagram, 'missing')).toHaveLength(0);
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

    it('creates a column designated as primary key', () => {
      const column = createColumn(
        'col-4',
        'id',
        'integer',
        false,
        undefined,
        true,
      );

      expect(column.primaryKey).toBe(true);
      expect(column.nullable).toBe(false);
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

  describe('Primary key model (TASK-011)', () => {
    function makePkTable(): Table {
      return makeTable({
        columns: [
          makeColumn({
            id: 'c1',
            name: 'id',
            dataType: 'integer',
            nullable: false,
            primaryKey: true,
          }),
          makeColumn({
            id: 'c2',
            name: 'email',
            dataType: 'varchar',
            nullable: false,
            primaryKey: false,
          }),
          makeColumn({
            id: 'c3',
            name: 'name',
            dataType: 'text',
            nullable: true,
            primaryKey: false,
          }),
        ],
      });
    }

    // AC1: Table model tracks primary key column
    it('findPrimaryKeyColumns returns the columns marked as primary key', () => {
      const table = makePkTable();
      const pks = findPrimaryKeyColumns(table);

      expect(pks).toHaveLength(1);
      expect(pks[0].id).toBe('c1');
      expect(pks[0].name).toBe('id');
    });

    it('findPrimaryKeyColumn returns the single primary key column', () => {
      const table = makePkTable();

      expect(findPrimaryKeyColumn(table)!.name).toBe('id');
    });

    it('findPrimaryKeyColumn returns undefined when there is no primary key', () => {
      const table = makeTable({
        columns: [
          makeColumn({ id: 'c1', name: 'id', primaryKey: false }),
          makeColumn({ id: 'c2', name: 'email', primaryKey: false }),
        ],
      });

      expect(findPrimaryKeyColumn(table)).toBeUndefined();
    });

    it('findPrimaryKeyColumn returns undefined when multiple columns are primary keys', () => {
      const table = makeTable({
        columns: [
          makeColumn({ id: 'c1', name: 'id', primaryKey: true }),
          makeColumn({ id: 'c2', name: 'email', primaryKey: true }),
        ],
      });

      expect(findPrimaryKeyColumn(table)).toBeUndefined();
    });

    it('hasPrimaryKey returns true when a primary key column exists', () => {
      expect(hasPrimaryKey(makePkTable())).toBe(true);
      expect(
        hasPrimaryKey(
          makeTable({ columns: [makeColumn({ primaryKey: false })] }),
        ),
      ).toBe(false);
    });

    // AC2: Only one column can be designated as primary key per table
    it('setPrimaryKeyColumn designates one column and clears all others', () => {
      const table = makePkTable();
      const updated = setPrimaryKeyColumn(table, 'c2');

      const pks = findPrimaryKeyColumns(updated);
      expect(pks).toHaveLength(1);
      expect(pks[0].name).toBe('email');
      expect(updated.columns.find((c) => c.id === 'c1')!.primaryKey).toBe(
        false,
      );
      expect(updated.columns.find((c) => c.id === 'c3')!.primaryKey).toBe(
        false,
      );
    });

    it('setPrimaryKeyColumn does not mutate the original table', () => {
      const table = makePkTable();
      setPrimaryKeyColumn(table, 'c2');

      expect(findPrimaryKeyColumn(table)!.name).toBe('id');
    });

    it('setPrimaryKeyColumn clears all primary key flags for an unknown column id', () => {
      const table = makePkTable();
      const updated = setPrimaryKeyColumn(table, 'nonexistent');

      expect(findPrimaryKeyColumns(updated)).toHaveLength(0);
      expect(hasPrimaryKey(updated)).toBe(false);
    });

    it('togglePrimaryKeyColumn designates a non-primary-key column and clears others', () => {
      const table = makePkTable();
      const updated = togglePrimaryKeyColumn(table, 'c2');

      expect(findPrimaryKeyColumn(updated)!.name).toBe('email');
      expect(updated.columns.find((c) => c.id === 'c1')!.primaryKey).toBe(
        false,
      );
    });

    it('togglePrimaryKeyColumn removes the primary key designation from the current primary key', () => {
      const table = makePkTable();
      const updated = togglePrimaryKeyColumn(table, 'c1');

      expect(findPrimaryKeyColumns(updated)).toHaveLength(0);
      expect(hasPrimaryKey(updated)).toBe(false);
    });

    // Entity integrity
    it('validatePrimaryKeyUniqueness is valid when there is at most one primary key', () => {
      expect(validatePrimaryKeyUniqueness(makePkTable()).valid).toBe(true);
      expect(
        validatePrimaryKeyUniqueness(
          makeTable({ columns: [makeColumn({ primaryKey: false })] }),
        ).valid,
      ).toBe(true);
    });

    it('validatePrimaryKeyUniqueness is invalid when multiple columns are primary keys', () => {
      const table = makeTable({
        columns: [
          makeColumn({ id: 'c1', name: 'id', primaryKey: true }),
          makeColumn({ id: 'c2', name: 'email', primaryKey: true }),
        ],
      });

      const result = validatePrimaryKeyUniqueness(table);
      expect(result.valid).toBe(false);
      expect(result.primaryKeyColumns).toHaveLength(2);
    });

    // AC3: Primary key designation is persisted in the diagram model
    it('primary key designation survives a serialize/deserialize round-trip', () => {
      const table = makePkTable();
      const updated = setPrimaryKeyColumn(table, 'c2');
      const diagram = {
        ...createEmptyDiagram('Pk Diagram'),
        tables: [updated],
      };

      const serialized = serializeDiagram(diagram);
      const deserialized = deserializeDiagram(serialized);

      const roundTrippedTable = deserialized.tables[0];
      expect(findPrimaryKeyColumn(roundTrippedTable)!.name).toBe('email');
      expect(findPrimaryKeyColumns(roundTrippedTable)).toHaveLength(1);
      expect(roundTrippedTable.columns.find((c) => c.id === 'c1')!.primaryKey).toBe(
        false,
      );
    });
  });
});
