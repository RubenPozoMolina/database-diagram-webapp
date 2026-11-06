/**
 * Unit tests for element manipulation (TASK-024).
 *
 * Acceptance criteria covered:
 *  1. Unit tests verify table movement (updateTablePosition).
 *  2. Unit tests verify table resizing (updateTable width/height).
 *  3. Unit tests verify table deletion (removeTable).
 *  4. Unit tests verify relationship deletion (removeRelationship).
 *  5. All tests pass.
 *
 * Tests run in jsdom so the full DOM API is available without a real browser.
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDiagram } from '../hooks/useDiagram';

function addTwoTables(result: ReturnType<typeof renderHook>['current']) {
  act(() => {
    result.current.addTable({
      name: 'users',
      x: 0,
      y: 0,
      width: 220,
      height: 120,
      columns: [],
      indexes: [],
    });
    result.current.addTable({
      name: 'orders',
      x: 300,
      y: 0,
      width: 220,
      height: 120,
      columns: [],
      indexes: [],
    });
  });
  return {
    userId: result.current.diagram.tables[0]!.id,
    orderId: result.current.diagram.tables[1]!.id,
  };
}

function addRelationship(
  result: ReturnType<typeof renderHook>['current'],
  sourceTableId: string,
  targetTableId: string,
): string {
  act(() => {
    result.current.addRelationship({
      sourceTableId,
      targetTableId,
    });
  });
  // Read the id after act() flushes the state update.
  return result.current.diagram.relationships[
    result.current.diagram.relationships.length - 1
  ]!.id;
}

describe('element manipulation (TASK-024)', () => {
  describe('table movement', () => {
    it('moves a table to a new position', () => {
      const { result } = renderHook(() => useDiagram());
      act(() => {
        result.current.addTable({
          name: 'users',
          x: 0,
          y: 0,
          width: 220,
          height: 120,
          columns: [],
          indexes: [],
        });
      });
      const tableId = result.current.diagram.tables[0]!.id;

      act(() => {
        result.current.updateTablePosition(tableId, { x: 150, y: 250 });
      });

      const table = result.current.diagram.tables.find((t) => t.id === tableId);
      expect(table).toBeDefined();
      expect(table!.x).toBe(150);
      expect(table!.y).toBe(250);
      // Other tables are unaffected.
      expect(result.current.diagram.tables).toHaveLength(1);
    });

    it('moving one table does not move other tables', () => {
      const { result } = renderHook(() => useDiagram());
      const { userId, orderId } = addTwoTables(result);

      act(() => {
        result.current.updateTablePosition(userId, { x: 999, y: 888 });
      });

      const user = result.current.diagram.tables.find((t) => t.id === userId)!;
      const order = result.current.diagram.tables.find((t) => t.id === orderId)!;
      expect(user.x).toBe(999);
      expect(user.y).toBe(888);
      expect(order.x).toBe(300);
      expect(order.y).toBe(0);
    });
  });

  describe('table resizing', () => {
    it('resizes a table width and height', () => {
      const { result } = renderHook(() => useDiagram());
      act(() => {
        result.current.addTable({
          name: 'users',
          x: 0,
          y: 0,
          width: 220,
          height: 120,
          columns: [],
          indexes: [],
        });
      });
      const tableId = result.current.diagram.tables[0]!.id;

      act(() => {
        result.current.updateTable(tableId, {
          width: 400,
          height: 300,
        });
      });

      const table = result.current.diagram.tables.find((t) => t.id === tableId);
      expect(table).toBeDefined();
      expect(table!.width).toBe(400);
      expect(table!.height).toBe(300);
      // Position is preserved when resizing.
      expect(table!.x).toBe(0);
      expect(table!.y).toBe(0);
    });

    it('resizing a table does not affect other tables', () => {
      const { result } = renderHook(() => useDiagram());
      const { userId, orderId } = addTwoTables(result);

      act(() => {
        result.current.updateTable(userId, { width: 500, height: 400 });
      });

      const user = result.current.diagram.tables.find((t) => t.id === userId)!;
      const order = result.current.diagram.tables.find((t) => t.id === orderId)!;
      expect(user.width).toBe(500);
      expect(user.height).toBe(400);
      expect(order.width).toBe(220);
      expect(order.height).toBe(120);
    });
  });

  describe('table deletion', () => {
    it('removes a table by id', () => {
      const { result } = renderHook(() => useDiagram());
      const { userId } = addTwoTables(result);

      act(() => {
        result.current.removeTable(userId);
      });

      expect(result.current.diagram.tables).toHaveLength(1);
      expect(
        result.current.diagram.tables.find((t) => t.id === userId),
      ).toBeUndefined();
    });

    it('removing a table removes relationships that reference it', () => {
      const { result } = renderHook(() => useDiagram());
      const { userId, orderId } = addTwoTables(result);
      const relationshipId = addRelationship(result, userId, orderId);

      expect(result.current.diagram.relationships).toHaveLength(1);

      act(() => {
        result.current.removeTable(userId);
      });

      expect(result.current.diagram.tables).toHaveLength(1);
      expect(result.current.diagram.tables[0]!.id).toBe(orderId);
      expect(result.current.diagram.relationships).toHaveLength(0);
      expect(
        result.current.diagram.relationships.find((r) => r.id === relationshipId),
      ).toBeUndefined();
    });
  });

  describe('relationship deletion', () => {
    it('removes a relationship by id while keeping both tables', () => {
      const { result } = renderHook(() => useDiagram());
      const { userId, orderId } = addTwoTables(result);
      const relationshipId = addRelationship(result, userId, orderId);

      expect(result.current.diagram.relationships).toHaveLength(1);

      act(() => {
        result.current.removeRelationship(relationshipId);
      });

      expect(result.current.diagram.relationships).toHaveLength(0);
      // Both tables remain on the diagram; only the relationship is removed.
      expect(result.current.diagram.tables).toHaveLength(2);
      expect(result.current.diagram.tables.map((t) => t.id)).toEqual([
        userId,
        orderId,
      ]);
    });

    it('removing one relationship leaves other relationships intact', () => {
      const { result } = renderHook(() => useDiagram());
      const { userId, orderId } = addTwoTables(result);
      const rel1Id = addRelationship(result, userId, orderId);
      const rel2Id = addRelationship(result, orderId, userId);

      expect(result.current.diagram.relationships).toHaveLength(2);

      act(() => {
        result.current.removeRelationship(rel1Id);
      });

      expect(result.current.diagram.relationships).toHaveLength(1);
      expect(result.current.diagram.relationships[0]!.id).toBe(rel2Id);
    });
  });
});
