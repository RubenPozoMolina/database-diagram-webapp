import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDiagram } from './useDiagram';
import { createEmptyDiagram } from '../types/diagram';

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
        indexes: [],
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
        indexes: [],
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
        indexes: [],
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
        indexes: [],
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
    expect(diagram.id).toBeDefined();
  });

  it('adds an index to a table column', () => {
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
          { id: 'c2', name: 'email', dataType: 'varchar', nullable: true, primaryKey: false },
        ],
        indexes: [],
      });
    });
    const tableId = result.current.diagram.tables[0].id;
    act(() => {
      result.current.addIndex(tableId, { name: 'idx_email', columnId: 'c2' });
    });
    const table = result.current.diagram.tables.find((t) => t.id === tableId);
    expect(table?.indexes).toHaveLength(1);
    expect(table?.indexes[0].name).toBe('idx_email');
    expect(table?.indexes[0].columnId).toBe('c2');
    expect(table?.indexes[0].id).toBeDefined();
  });

  it('removes an index from a table', () => {
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
          { id: 'c2', name: 'email', dataType: 'varchar', nullable: true, primaryKey: false },
        ],
        indexes: [],
      });
    });
    const tableId = result.current.diagram.tables[0].id;
    act(() => {
      result.current.addIndex(tableId, { name: 'idx_email', columnId: 'c2' });
    });
    const indexId = result.current.diagram.tables[0].indexes[0].id;
    act(() => {
      result.current.removeIndex(tableId, indexId);
    });
    const table = result.current.diagram.tables.find((t) => t.id === tableId);
    expect(table?.indexes).toHaveLength(0);
  });

  it('updates an index name and column', () => {
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
          { id: 'c2', name: 'email', dataType: 'varchar', nullable: true, primaryKey: false },
          { id: 'c3', name: 'name', dataType: 'text', nullable: true, primaryKey: false },
        ],
        indexes: [],
      });
    });
    const tableId = result.current.diagram.tables[0].id;
    act(() => {
      result.current.addIndex(tableId, { name: 'idx_email', columnId: 'c2' });
    });
    const indexId = result.current.diagram.tables[0].indexes[0].id;
    act(() => {
      result.current.updateIndex(tableId, indexId, {
        name: 'idx_user_email',
        columnId: 'c3',
      });
    });
    const table = result.current.diagram.tables.find((t) => t.id === tableId);
    expect(table?.indexes).toHaveLength(1);
    expect(table?.indexes[0].name).toBe('idx_user_email');
    expect(table?.indexes[0].columnId).toBe('c3');
  });
});
