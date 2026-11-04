/**
 * Unit tests for the DiagramCanvas component.
 *
 * These tests verify the acceptance criteria of TASK-001:
 *  1. Empty canvas is displayed when the application loads.
 *  2. Canvas supports rendering table nodes.
 *  3. Canvas supports rendering relationship lines between tables.
 *
 * Tests run in jsdom so the HTMLCanvasElement and CanvasRenderingContext2D
 * API surface is available without a real browser.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DiagramCanvas } from '../canvas/DiagramCanvas';

function createCanvas(width = 1200, height = 800): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

describe('DiagramCanvas', () => {
  let canvas: HTMLCanvasElement;
  let clearRectSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    canvas = createCanvas();
    clearRectSpy = vi.spyOn(canvas.getContext('2d')!, 'clearRect');
  });

  describe('empty canvas (criterion 1)', () => {
    it('starts with no tables and no relationships', () => {
      const diagram = new DiagramCanvas(canvas);
      expect(diagram.isEmpty).toBe(true);
      expect(diagram.tableCount).toBe(0);
      expect(diagram.relationshipCount).toBe(0);
    });

    it('getState returns empty arrays on a fresh canvas', () => {
      const diagram = new DiagramCanvas(canvas);
      const state = diagram.getState();
      expect(state.tables).toEqual([]);
      expect(state.relationships).toEqual([]);
    });

    it('render clears the canvas (empty workspace)', () => {
      const diagram = new DiagramCanvas(canvas);
      diagram.render();
      expect(clearRectSpy).toHaveBeenCalledWith(0, 0, 1200, 800);
    });
  });

  describe('table nodes (criterion 2)', () => {
    it('addTable adds a table and increments tableCount', () => {
      const diagram = new DiagramCanvas(canvas);
      diagram.addTable({
        id: 't1',
        name: 'users',
        position: { x: 50, y: 50 },
        columns: [
          { name: 'id', type: 'integer', isPrimaryKey: true, isNullable: false },
          { name: 'email', type: 'text', isPrimaryKey: false, isNullable: false },
        ],
      });

      expect(diagram.tableCount).toBe(1);
      expect(diagram.isEmpty).toBe(false);

      const state = diagram.getState();
      expect(state.tables).toHaveLength(1);
      expect(state.tables[0]!.id).toBe('t1');
      expect(state.tables[0]!.name).toBe('users');
      expect(state.tables[0]!.columns).toHaveLength(2);
    });

    it('computes table size from content when size is not provided', () => {
      const diagram = new DiagramCanvas(canvas);
      diagram.addTable({ id: 't1', name: 'users', columns: [] });

      const state = diagram.getState();
      const table = state.tables[0]!;
      expect(table.size.width).toBeGreaterThan(0);
      expect(table.size.height).toBeGreaterThan(0);
    });

    it('render draws a table (calls fillRect / fillText)', () => {
      const ctx = canvas.getContext('2d')!;
      const fillRectSpy = vi.spyOn(ctx, 'fillRect');
      const fillTextSpy = vi.spyOn(ctx, 'fillText');

      const diagram = new DiagramCanvas(canvas);
      diagram.addTable({
        id: 't1',
        name: 'users',
        position: { x: 100, y: 100 },
        columns: [
          { name: 'id', type: 'integer', isPrimaryKey: true, isNullable: false },
        ],
      });
      diagram.render();

      expect(fillRectSpy).toHaveBeenCalled();
      expect(fillTextSpy).toHaveBeenCalledWith(
        'users',
        expect.any(Number),
        expect.any(Number),
        expect.any(Number),
      );
    });

    it('removeTable removes the table and its relationships', () => {
      const diagram = new DiagramCanvas(canvas);
      diagram.addTable({ id: 't1', name: 'table_one' });
      diagram.addTable({ id: 't2', name: 'table_two' });
      diagram.addRelationship({
        id: 'r1',
        sourceTableId: 't1',
        targetTableId: 't2',
      });

      expect(diagram.tableCount).toBe(2);
      expect(diagram.relationshipCount).toBe(1);

      diagram.removeTable('t1');

      expect(diagram.tableCount).toBe(1);
      expect(diagram.relationshipCount).toBe(0);
      expect(diagram.getState().tables[0]!.id).toBe('t2');
    });

    it('clearing the canvas empties it again', () => {
      const diagram = new DiagramCanvas(canvas);
      diagram.addTable({ id: 't1', name: 'users' });
      diagram.clear();

      expect(diagram.isEmpty).toBe(true);
      expect(diagram.tableCount).toBe(0);
      expect(diagram.relationshipCount).toBe(0);
    });
  });

  describe('relationship lines (criterion 3)', () => {
    it('addRelationship adds a line between two tables', () => {
      const diagram = new DiagramCanvas(canvas);
      diagram.addTable({ id: 't1', name: 'users' });
      diagram.addTable({ id: 't2', name: 'orders' });
      diagram.addRelationship({
        id: 'r1',
        sourceTableId: 't1',
        targetTableId: 't2',
        sourceColumn: 'id',
        targetColumn: 'user_id',
      });

      expect(diagram.relationshipCount).toBe(1);

      const state = diagram.getState();
      expect(state.relationships).toHaveLength(1);
      expect(state.relationships[0]!.id).toBe('r1');
      expect(state.relationships[0]!.sourceTableId).toBe('t1');
      expect(state.relationships[0]!.targetTableId).toBe('t2');
      expect(state.relationships[0]!.sourceColumn).toBe('id');
      expect(state.relationships[0]!.targetColumn).toBe('user_id');
    });

    it('render draws a relationship line (calls moveTo / lineTo / stroke)', () => {
      const ctx = canvas.getContext('2d')!;
      const moveToSpy = vi.spyOn(ctx, 'moveTo');
      const lineToSpy = vi.spyOn(ctx, 'lineTo');
      const strokeSpy = vi.spyOn(ctx, 'stroke');

      const diagram = new DiagramCanvas(canvas);
      diagram.addTable({
        id: 't1',
        name: 'users',
        position: { x: 100, y: 100 },
        size: { width: 200, height: 120 },
      });
      diagram.addTable({
        id: 't2',
        name: 'orders',
        position: { x: 500, y: 100 },
        size: { width: 200, height: 120 },
      });
      diagram.addRelationship({
        id: 'r1',
        sourceTableId: 't1',
        targetTableId: 't2',
      });
      diagram.render();

      expect(moveToSpy).toHaveBeenCalled();
      expect(lineToSpy).toHaveBeenCalled();
      expect(strokeSpy).toHaveBeenCalled();
    });

    it('removeRelationship removes a single relationship', () => {
      const diagram = new DiagramCanvas(canvas);
      diagram.addTable({ id: 't1', name: 'users' });
      diagram.addTable({ id: 't2', name: 'orders' });
      diagram.addRelationship({ id: 'r1', sourceTableId: 't1', targetTableId: 't2' });
      diagram.addRelationship({ id: 'r2', sourceTableId: 't2', targetTableId: 't1' });

      expect(diagram.relationshipCount).toBe(2);

      diagram.removeRelationship('r1');

      expect(diagram.relationshipCount).toBe(1);
      expect(diagram.getState().relationships[0]!.id).toBe('r2');
    });
  });
});

/**
 * Unit tests for table addition to canvas (TASK-006).
 *
 * Acceptance criteria:
 *  1. Unit tests verify table appears on canvas after addition.
 *  2. Unit tests verify table has correct name and columns.
 */
describe('table addition to canvas (TASK-006)', () => {
  function createCanvas(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 800;
    return canvas;
  }

  it('table appears on canvas after addition', () => {
    const canvas = createCanvas();
    const diagram = new DiagramCanvas(canvas);

    expect(diagram.tableCount).toBe(0);
    expect(diagram.isEmpty).toBe(true);

    diagram.addTable({
      id: 't1',
      name: 'users',
      position: { x: 100, y: 200 },
      columns: [],
    });

    expect(diagram.tableCount).toBe(1);
    expect(diagram.isEmpty).toBe(false);

    const state = diagram.getState();
    expect(state.tables).toHaveLength(1);
    expect(state.tables[0]!.id).toBe('t1');
    expect(state.tables[0]!.position).toEqual({ x: 100, y: 200 });
  });

  it('table has correct name after addition', () => {
    const canvas = createCanvas();
    const diagram = new DiagramCanvas(canvas);

    diagram.addTable({
      id: 't1',
      name: 'users',
      columns: [],
    });

    const state = diagram.getState();
    expect(state.tables[0]!.name).toBe('users');

    diagram.addTable({
      id: 't2',
      name: 'orders',
      columns: [],
    });

    const tables = diagram.getState().tables;
    expect(tables).toHaveLength(2);
    expect(tables[0]!.name).toBe('users');
    expect(tables[1]!.name).toBe('orders');
  });

  it('table has correct columns after addition', () => {
    const canvas = createCanvas();
    const diagram = new DiagramCanvas(canvas);

    diagram.addTable({
      id: 't1',
      name: 'users',
      columns: [
        { name: 'id', type: 'integer', isPrimaryKey: true, isNullable: false },
        { name: 'email', type: 'text', isPrimaryKey: false, isNullable: false },
        { name: 'created_at', type: 'timestamp', isPrimaryKey: false, isNullable: true },
      ],
    });

    const state = diagram.getState();
    const table = state.tables[0]!;
    expect(table.columns).toHaveLength(3);

    expect(table.columns[0]).toEqual({
      name: 'id',
      type: 'integer',
      isPrimaryKey: true,
      isNullable: false,
    });
    expect(table.columns[1]).toEqual({
      name: 'email',
      type: 'text',
      isPrimaryKey: false,
      isNullable: false,
    });
    expect(table.columns[2]).toEqual({
      name: 'created_at',
      type: 'timestamp',
      isPrimaryKey: false,
      isNullable: true,
    });
  });

  it('table with empty column list appears on canvas', () => {
    const canvas = createCanvas();
    const diagram = new DiagramCanvas(canvas);

    diagram.addTable({ id: 't1', name: 'empty_table', columns: [] });

    const state = diagram.getState();
    expect(state.tables).toHaveLength(1);
    expect(state.tables[0]!.name).toBe('empty_table');
    expect(state.tables[0]!.columns).toEqual([]);
  });

  it('multiple tables can be added independently with their own columns', () => {
    const canvas = createCanvas();
    const diagram = new DiagramCanvas(canvas);

    diagram.addTable({
      id: 't1',
      name: 'users',
      columns: [
        { name: 'id', type: 'integer', isPrimaryKey: true, isNullable: false },
      ],
    });
    diagram.addTable({
      id: 't2',
      name: 'orders',
      columns: [
        { name: 'order_id', type: 'integer', isPrimaryKey: true, isNullable: false },
        { name: 'user_id', type: 'integer', isPrimaryKey: false, isNullable: false },
        { name: 'total', type: 'numeric', isPrimaryKey: false, isNullable: true },
      ],
    });

    const state = diagram.getState();
    expect(state.tables).toHaveLength(2);

    const users = state.tables.find((t) => t.id === 't1')!;
    expect(users.name).toBe('users');
    expect(users.columns).toHaveLength(1);
    expect(users.columns[0].name).toBe('id');

    const orders = state.tables.find((t) => t.id === 't2')!;
    expect(orders.name).toBe('orders');
    expect(orders.columns).toHaveLength(3);
    expect(orders.columns.map((c) => c.name)).toEqual([
      'order_id',
      'user_id',
      'total',
    ]);
  });
});
