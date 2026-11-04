/**
 * Unit tests for foreign key relationships (TASK-015).
 *
 * Covers the acceptance criteria of STORY-005 / TASK-015:
 *  1. Relationship line is drawn between tables (canvas rendering)
 *  2. Foreign key is recorded in the diagram model
 *  3. Column-to-column mapping is recorded on the relationship
 *
 * These tests are owned by QA Automation and run independently of the
 * implementation tickets (TASK-013, TASK-014).
 */

import { describe, it, expect, vi } from 'vitest';
import { drawRelationship } from '../canvas/RelationshipLine';
import type { RelationshipLine, TableNode } from '../types';
import {
  createColumn,
  createEmptyDiagram,
  createRelationship,
  createTable,
  findRelationshipById,
  findRelationshipsByTable,
  type Column,
  type Diagram,
  type Relationship,
  type Table,
  validateReferentialIntegrity,
} from '../types/diagram';

function makeCanvasColumn(overrides: Partial<Column> = {}): Column {
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

function makeCanvasTable(overrides: Partial<TableNode> = {}): TableNode {
  return {
    id: 'table-1',
    name: 'users',
    position: { x: 100, y: 100 },
    size: { width: 200, height: 120 },
    columns: [],
    ...overrides,
  };
}

function makeDiagramColumn(overrides: Partial<Column> = {}): Column {
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

function makeDiagramTable(overrides: Partial<Table> = {}): Table {
  return {
    id: 'table-1',
    name: 'users',
    x: 100,
    y: 100,
    width: 240,
    height: 200,
    columns: [makeDiagramColumn()],
    indexes: [],
    ...overrides,
  };
}

function makeContext(): CanvasRenderingContext2D {
  const canvas = document.createElement('canvas');
  canvas.width = 1000;
  canvas.height = 1000;
  return canvas.getContext('2d')!;
}

describe('Foreign key: relationship line drawn between tables (AC1)', () => {
  it('draws a line between two tables (moveTo, lineTo, stroke called)', () => {
    const ctx = makeContext();
    const moveToSpy = vi.spyOn(ctx, 'moveTo');
    const lineToSpy = vi.spyOn(ctx, 'lineTo');
    const strokeSpy = vi.spyOn(ctx, 'stroke');

    const tables = new Map<string, TableNode>([
      ['t1', makeCanvasTable({ id: 't1', name: 'users' })],
      ['t2', makeCanvasTable({ id: 't2', name: 'orders' })],
    ]);

    const relationship: RelationshipLine = {
      id: 'r1',
      sourceTableId: 't1',
      targetTableId: 't2',
    };

    const result = drawRelationship(ctx, relationship, tables);

    expect(result).toBe(true);
    expect(moveToSpy).toHaveBeenCalled();
    expect(lineToSpy).toHaveBeenCalled();
    expect(strokeSpy).toHaveBeenCalled();
  });

  it('returns false when the source table is missing', () => {
    const ctx = makeContext();
    const tables = new Map<string, TableNode>([
      ['t2', makeCanvasTable({ id: 't2', name: 'orders' })],
    ]);

    const relationship: RelationshipLine = {
      id: 'r1',
      sourceTableId: 'missing',
      targetTableId: 't2',
    };

    expect(drawRelationship(ctx, relationship, tables)).toBe(false);
  });

  it('returns false when the target table is missing', () => {
    const ctx = makeContext();
    const tables = new Map<string, TableNode>([
      ['t1', makeCanvasTable({ id: 't1', name: 'users' })],
    ]);

    const relationship: RelationshipLine = {
      id: 'r1',
      sourceTableId: 't1',
      targetTableId: 'missing',
    };

    expect(drawRelationship(ctx, relationship, tables)).toBe(false);
  });

  it('returns false when both tables are missing', () => {
    const ctx = makeContext();
    const tables = new Map<string, TableNode>();

    const relationship: RelationshipLine = {
      id: 'r1',
      sourceTableId: 't1',
      targetTableId: 't2',
    };

    expect(drawRelationship(ctx, relationship, tables)).toBe(false);
  });

  it('computes closest edge points on both tables', () => {
    const ctx = makeContext();
    const moveToSpy = vi.spyOn(ctx, 'moveTo');
    const lineToSpy = vi.spyOn(ctx, 'lineTo');

    const tables = new Map<string, TableNode>([
      ['t1', makeCanvasTable({ id: 't1', name: 'users', position: { x: 100, y: 100 } })],
      ['t2', makeCanvasTable({ id: 't2', name: 'orders', position: { x: 500, y: 100 } })],
    ]);

    const relationship: RelationshipLine = {
      id: 'r1',
      sourceTableId: 't1',
      targetTableId: 't2',
    };

    drawRelationship(ctx, relationship, tables);

    // moveTo should be on the right edge of the source table (t1).
    // (drawArrowhead also calls moveTo, so we check the first call.)
    const moveToCalls = moveToSpy.mock.calls as Array<[number, number]>;
    const [moveX, moveY] = moveToCalls[0]!;
    expect(moveX).toBe(300); // source right edge: 100 + 200
    expect(moveY).toBe(160); // within source vertical range [100, 220]

    // lineTo should be on the left edge of the target table (t2).
    const lineToCalls = lineToSpy.mock.calls as Array<[number, number]>;
    const [lineX, lineY] = lineToCalls[0]!;
    expect(lineX).toBe(500); // target left edge
    expect(lineY).toBe(160); // within target vertical range
  });
});

describe('Foreign key: recorded in the diagram model (AC2)', () => {
  it('creates a relationship linking two tables by id', () => {
    const relationship: Relationship = {
      id: 'rel-1',
      sourceTableId: 'table-1',
      targetTableId: 'table-2',
    };

    expect(relationship.sourceTableId).toBe('table-1');
    expect(relationship.targetTableId).toBe('table-2');
  });

  it('findRelationshipById returns the recorded relationship', () => {
    const diagram: Diagram = {
      ...createEmptyDiagram(),
      relationships: [
        { id: 'rel-1', sourceTableId: 't1', targetTableId: 't2' },
      ],
    };

    const found = findRelationshipById(diagram, 'rel-1');
    expect(found).toBeDefined();
    expect(found!.id).toBe('rel-1');
    expect(found!.sourceTableId).toBe('t1');
    expect(found!.targetTableId).toBe('t2');
  });

  it('findRelationshipById returns undefined for an unknown relationship', () => {
    const diagram: Diagram = {
      ...createEmptyDiagram(),
      relationships: [
        { id: 'rel-1', sourceTableId: 't1', targetTableId: 't2' },
      ],
    };

    expect(findRelationshipById(diagram, 'missing')).toBeUndefined();
  });

  it('findRelationshipsByTable returns relationships where the table is source', () => {
    const diagram: Diagram = {
      ...createEmptyDiagram(),
      tables: [
        makeDiagramTable({ id: 't1', name: 'users' }),
        makeDiagramTable({ id: 't2', name: 'orders' }),
        makeDiagramTable({ id: 't3', name: 'products' }),
      ],
      relationships: [
        createRelationship('r1', 't2', undefined, 't1', undefined), // t2 is source
        createRelationship('r2', 't3', undefined, 't1', undefined), // t2 not involved
      ],
    };

    const sourceRels = findRelationshipsByTable(diagram, 't2');
    expect(sourceRels).toHaveLength(1);
    expect(sourceRels[0]!.id).toBe('r1');
    expect(sourceRels[0]!.sourceTableId).toBe('t2');
  });

  it('findRelationshipsByTable returns relationships where the table is target', () => {
    const diagram: Diagram = {
      ...createEmptyDiagram(),
      tables: [
        makeDiagramTable({ id: 't1', name: 'users' }),
        makeDiagramTable({ id: 't2', name: 'orders' }),
        makeDiagramTable({ id: 't3', name: 'products' }),
      ],
      relationships: [
        createRelationship('r1', 't2', undefined, 't1', undefined), // t1 is target
        createRelationship('r2', 't3', undefined, 't1', undefined), // t1 is target again
      ],
    };

    const targetRels = findRelationshipsByTable(diagram, 't1');
    expect(targetRels).toHaveLength(2);
    expect(targetRels.map((r) => r.id)).toEqual(['r1', 'r2']);
    expect(targetRels.every((r) => r.targetTableId === 't1')).toBe(true);
  });

  it('findRelationshipsByTable returns empty for a table with no relationships', () => {
    const diagram: Diagram = {
      ...createEmptyDiagram(),
      tables: [
        makeDiagramTable({ id: 't1', name: 'users' }),
        makeDiagramTable({ id: 't2', name: 'orders' }),
      ],
      relationships: [
        createRelationship('r1', 't1', undefined, 't2', undefined),
      ],
    };

    expect(findRelationshipsByTable(diagram, 'missing')).toHaveLength(0);
  });

  it('createEmptyDiagram produces a diagram with no relationships', () => {
    const diagram: Diagram = createEmptyDiagram('New Diagram');

    expect(diagram.relationships).toEqual([]);
  });
});

describe('Foreign key: column-to-column mapping (AC3)', () => {
  it('createRelationship records source and target column ids', () => {
    const relationship = createRelationship(
      'rel-1',
      'table-1',
      'col-2',
      'table-2',
      'col-1',
    );

    expect(relationship.sourceColumnId).toBe('col-2');
    expect(relationship.targetColumnId).toBe('col-1');
  });

  it('relationship object preserves source and target column mapping', () => {
    const relationship: Relationship = {
      id: 'rel-1',
      sourceTableId: 'orders',
      sourceColumnId: 'user_id',
      targetTableId: 'users',
      targetColumnId: 'id',
    };

    expect(relationship.sourceColumnId).toBe('user_id');
    expect(relationship.targetColumnId).toBe('id');
  });

  it('createRelationship allows undefined column ids (no column mapping)', () => {
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

  it('column-to-column mapping survives on the diagram model', () => {
    const diagram: Diagram = {
      ...createEmptyDiagram(),
      tables: [
        makeDiagramTable({
          id: 't1',
          name: 'users',
          columns: [
            makeDiagramColumn({ id: 'c1', name: 'id', primaryKey: true }),
            makeDiagramColumn({ id: 'c2', name: 'email', primaryKey: false }),
          ],
        }),
        makeDiagramTable({
          id: 't2',
          name: 'orders',
          columns: [
            makeDiagramColumn({ id: 'c3', name: 'id', primaryKey: true }),
            makeDiagramColumn({ id: 'c4', name: 'user_id', primaryKey: false }),
          ],
        }),
      ],
      relationships: [
        createRelationship('r1', 't2', 'c4', 't1', 'c1'),
      ],
    };

    const rel = findRelationshipById(diagram, 'r1')!;
    expect(rel.sourceColumnId).toBe('c4'); // orders.user_id
    expect(rel.targetColumnId).toBe('c1'); // users.id

    // The referenced columns exist on their respective tables.
    const sourceTable = diagram.tables.find((t) => t.id === 't2')!;
    const targetTable = diagram.tables.find((t) => t.id === 't1')!;
    expect(sourceTable.columns.find((c) => c.id === 'c4')!.name).toBe('user_id');
    expect(targetTable.columns.find((c) => c.id === 'c1')!.name).toBe('id');
  });

  it('validateReferentialIntegrity passes when column mapping targets a primary key', () => {
    const diagram: Diagram = {
      ...createEmptyDiagram(),
      tables: [
        makeDiagramTable({
          id: 't1',
          name: 'users',
          columns: [
            makeDiagramColumn({ id: 'c1', name: 'id', primaryKey: true }),
          ],
        }),
        makeDiagramTable({
          id: 't2',
          name: 'orders',
          columns: [
            makeDiagramColumn({ id: 'c2', name: 'id', primaryKey: true }),
            makeDiagramColumn({ id: 'c3', name: 'user_id', primaryKey: false }),
          ],
        }),
      ],
      relationships: [
        createRelationship('r1', 't2', 'c3', 't1', 'c1', 'cascade', 'no action'),
      ],
    };

    const violations = validateReferentialIntegrity(diagram);
    expect(violations).toEqual([]);
  });

  it('createColumn factory supports primary key designation for FK targets', () => {
    const pkColumn = createColumn('col-1', 'id', 'integer', false, undefined, true);
    const fkColumn = createColumn('col-2', 'user_id', 'integer', false);

    expect(pkColumn.primaryKey).toBe(true);
    expect(fkColumn.primaryKey).toBe(false);
  });

  it('createTable factory holds columns for foreign key source and target', () => {
    const columns = [
      createColumn('col-1', 'id', 'integer', false, undefined, true),
      createColumn('col-2', 'user_id', 'integer', false),
    ];
    const table = createTable('table-1', 'orders', 0, 0, 220, 120, columns);

    expect(table.columns).toHaveLength(2);
    expect(table.columns[0].name).toBe('id');
    expect(table.columns[0].primaryKey).toBe(true);
    expect(table.columns[1].name).toBe('user_id');
    expect(table.columns[1].primaryKey).toBe(false);
  });
});
