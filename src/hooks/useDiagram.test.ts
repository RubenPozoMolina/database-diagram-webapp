import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDiagram } from './useDiagram';
import { createEmptyDiagram, createUniqueConstraint, findUniqueConstraintsByTable } from '../types/diagram';

describe('useDiagram', () => {
  it('initializes with an empty diagram', () => {
    const { result } = renderHook(() => useDiagram('Test Diagram'));
    expect(result.current.diagram.tables).toEqual([]);
    expect(result.current.diagram.relationships).toEqual([]);
    expect(result.current.diagram.name).toBe('Test Diagram');
  });

  it('adds a table to the diagram', () => {
    const { result } = renderHook(() => useDiagram());
    act(() => {
      result.current.addTable({
        name: 'users',
        x: 100,
        y: 200,
        width: 220,
        height: 120,
        columns: [],
      });
    });
    expect(result.current.diagram.tables).toHaveLength(1);
    expect(result.current.diagram.tables[0].name).toBe('users');
    expect(result.current.diagram.tables[0].id).toBeDefined();
  });

  it('adds a relationship between tables', () => {
    const { result } = renderHook(() => useDiagram());
    act(() => {
      result.current.addTable({
        name: 'users',
        x: 0,
        y: 0,
        width: 220,
        height: 120,
        columns: [],
      });
      result.current.addTable({
        name: 'orders',
        x: 300,
        y: 0,
        width: 220,
        height: 120,
        columns: [],
      });
    });
    const userId = result.current.diagram.tables[0].id;
    const orderId = result.current.diagram.tables[1].id;
    act(() => {
      result.current.addRelationship({
        sourceTableId: userId,
        targetTableId: orderId,
      });
    });
    expect(result.current.diagram.relationships).toHaveLength(1);
    expect(result.current.diagram.relationships[0].sourceTableId).toBe(userId);
    expect(result.current.diagram.relationships[0].targetTableId).toBe(
      orderId,
    );
    expect(result.current.diagram.relationships[0].id).toBeDefined();
  });

  it('removes a table and its relationships', () => {
    const { result } = renderHook(() => useDiagram());
    act(() => {
      result.current.addTable({
        name: 'users',
        x: 0,
        y: 0,
        width: 220,
        height: 120,
        columns: [],
      });
      result.current.addTable({
        name: 'orders',
        x: 300,
        y: 0,
        width: 220,
        height: 120,
        columns: [],
      });
    });
    const userId = result.current.diagram.tables[0].id;
    const orderId = result.current.diagram.tables[1].id;
    act(() => {
      result.current.addRelationship({
        sourceTableId: userId,
        targetTableId: orderId,
      });
      result.current.removeTable(userId);
    });
    expect(result.current.diagram.tables).toHaveLength(1);
    expect(result.current.diagram.tables[0].id).toBe(orderId);
    expect(result.current.diagram.relationships).toHaveLength(0);
  });

  it('creates a new empty diagram', () => {
    const { result } = renderHook(() => useDiagram('First'));
    act(() => {
      result.current.addTable({
        name: 'users',
        x: 0,
        y: 0,
        width: 220,
        height: 120,
        columns: [],
      });
      result.current.createNewDiagram('Second');
    });
    expect(result.current.diagram.name).toBe('Second');
    expect(result.current.diagram.tables).toEqual([]);
    expect(result.current.diagram.relationships).toEqual([]);
    expect(result.current.diagram.id).not.toBeUndefined();
  });

  it('updates table position', () => {
    const { result } = renderHook(() => useDiagram());
    act(() => {
      result.current.addTable({
        name: 'users',
        x: 0,
        y: 0,
        width: 220,
        height: 120,
        columns: [],
      });
    });
    const tableId = result.current.diagram.tables[0].id;
    act(() => {
      result.current.updateTablePosition(tableId, { x: 50, y: 75 });
    });
    expect(result.current.diagram.tables[0].x).toBe(50);
    expect(result.current.diagram.tables[0].y).toBe(75);
  });

  it('updates table columns through updateTable', () => {
    const { result } = renderHook(() => useDiagram());
    act(() => {
      result.current.addTable({
        name: 'users',
        x: 0,
        y: 0,
        width: 220,
        height: 120,
        columns: [
          { id: 'c1', name: 'id', dataType: 'integer', nullable: false, primaryKey: true },
        ],
      });
    });
    const tableId = result.current.diagram.tables[0].id;
    act(() => {
      result.current.updateTable(tableId, {
        columns: [
          { id: 'c1', name: 'user_id', dataType: 'bigint', nullable: false, primaryKey: true },
        ],
      });
    });
    expect(result.current.diagram.tables[0].columns).toHaveLength(1);
    expect(result.current.diagram.tables[0].columns[0].name).toBe('user_id');
    expect(result.current.diagram.tables[0].columns[0].dataType).toBe('bigint');
    expect(result.current.diagram.tables[0].columns[0].nullable).toBe(false);
    expect(result.current.diagram.tables[0].columns[0].primaryKey).toBe(true);
  });

  it('createEmptyDiagram produces a valid empty diagram', () => {
    const diagram = createEmptyDiagram();
    expect(diagram.tables).toEqual([]);
    expect(diagram.relationships).toEqual([]);
    expect(diagram.uniqueConstraints).toEqual([]);
    expect(diagram.id).toBeDefined();
  });

  it('adds a unique constraint to a table', () => {
    const { result } = renderHook(() => useDiagram());
    act(() => {
      result.current.addTable({
        name: 'users',
        x: 0,
        y: 0,
        width: 220,
        height: 120,
        columns: [
          { id: 'c1', name: 'id', dataType: 'integer', nullable: false, primaryKey: true },
          { id: 'c2', name: 'email', dataType: 'varchar', nullable: false, primaryKey: false },
        ],
      });
    });
    const tableId = result.current.diagram.tables[0].id;
    act(() => {
      result.current.addUniqueConstraint(tableId, ['c2'], 'users_email_key');
    });
    expect(result.current.diagram.uniqueConstraints).toHaveLength(1);
    expect(result.current.diagram.uniqueConstraints[0].tableId).toBe(tableId);
    expect(result.current.diagram.uniqueConstraints[0].columnIds).toEqual(['c2']);
    expect(result.current.diagram.uniqueConstraints[0].name).toBe('users_email_key');
    expect(result.current.diagram.uniqueConstraints[0].id).toBeDefined();
  });

  it('supports composite unique constraints on column groups', () => {
    const { result } = renderHook(() => useDiagram());
    act(() => {
      result.current.addTable({
        name: 'orders',
        x: 0,
        y: 0,
        width: 220,
        height: 120,
        columns: [
          { id: 'c1', name: 'order_id', dataType: 'integer', nullable: false, primaryKey: true },
          { id: 'c2', name: 'user_id', dataType: 'integer', nullable: false, primaryKey: false },
          { id: 'c3', name: 'product_id', dataType: 'integer', nullable: false, primaryKey: false },
        ],
      });
    });
    const tableId = result.current.diagram.tables[0].id;
    act(() => {
      result.current.addUniqueConstraint(tableId, ['c2', 'c3'], 'orders_user_product_key');
    });
    expect(result.current.diagram.uniqueConstraints).toHaveLength(1);
    expect(result.current.diagram.uniqueConstraints[0].columnIds).toEqual(['c2', 'c3']);
  });

  it('removes a unique constraint by id', () => {
    const { result } = renderHook(() => useDiagram());
    act(() => {
      result.current.addTable({
        name: 'users',
        x: 0,
        y: 0,
        width: 220,
        height: 120,
        columns: [
          { id: 'c1', name: 'id', dataType: 'integer', nullable: false, primaryKey: true },
          { id: 'c2', name: 'email', dataType: 'varchar', nullable: false, primaryKey: false },
        ],
      });
    });
    const tableId = result.current.diagram.tables[0].id;
    act(() => {
      result.current.addUniqueConstraint(tableId, ['c2'], 'users_email_key');
    });
    const constraintId = result.current.diagram.uniqueConstraints[0].id;
    act(() => {
      result.current.removeUniqueConstraint(constraintId);
    });
    expect(result.current.diagram.uniqueConstraints).toHaveLength(0);
  });

  it('removes unique constraints when a table is removed', () => {
    const { result } = renderHook(() => useDiagram());
    act(() => {
      result.current.addTable({
        name: 'users',
        x: 0,
        y: 0,
        width: 220,
        height: 120,
        columns: [
          { id: 'c1', name: 'id', dataType: 'integer', nullable: false, primaryKey: true },
          { id: 'c2', name: 'email', dataType: 'varchar', nullable: false, primaryKey: false },
        ],
      });
    });
    const tableId = result.current.diagram.tables[0].id;
    act(() => {
      result.current.addUniqueConstraint(tableId, ['c2'], 'users_email_key');
    });
    act(() => {
      result.current.removeTable(tableId);
    });
    expect(result.current.diagram.tables).toHaveLength(0);
    expect(result.current.diagram.uniqueConstraints).toHaveLength(0);
  });

  it('findUniqueConstraintsByTable returns constraints for a specific table', () => {
    const diagram = createEmptyDiagram();
    const tableId = 't1';
    const constraint = createUniqueConstraint('uc1', tableId, ['c2'], 'users_email_key');
    const updated = {
      ...diagram,
      tables: [{ id: tableId, name: 'users', x: 0, y: 0, width: 220, height: 120, columns: [] }],
      uniqueConstraints: [constraint],
    };
    expect(findUniqueConstraintsByTable(updated, tableId)).toEqual([constraint]);
    expect(findUniqueConstraintsByTable(updated, 'nonexistent')).toEqual([]);
  });
});
