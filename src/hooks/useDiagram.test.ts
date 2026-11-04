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

  /* ---- TASK-023: delete elements ---- */

  it('removes a relationship by id while keeping both tables', () => {
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
    const relationshipId = result.current.diagram.relationships[0].id;
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
    expect(diagram.uniqueConstraints).toEqual([]);
    expect(diagram.id).toBeDefined();
  });

  /* ---- STORY-007: index tests ---- */

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
      result.current.addIndex(tableId, { name: 'idx_email', columnIds: ['c2'] });
    });
    const table = result.current.diagram.tables.find((t) => t.id === tableId);
    expect(table?.indexes).toHaveLength(1);
    expect(table?.indexes[0].name).toBe('idx_email');
    expect(table?.indexes[0].columnIds).toEqual(['c2']);
    expect(table?.indexes[0].id).toBeDefined();
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
        indexes: [],
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
      result.current.addIndex(tableId, { name: 'idx_email', columnIds: ['c2'] });
    });
    const indexId = result.current.diagram.tables[0].indexes[0].id;
    act(() => {
      result.current.removeIndex(tableId, indexId);
    });
    const table = result.current.diagram.tables.find((t) => t.id === tableId);
    expect(table?.indexes).toHaveLength(0);
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
        indexes: [],
      });
    });
    const tableId = result.current.diagram.tables[0].id;
    act(() => {
      result.current.addUniqueConstraint(tableId, ['c2', 'c3'], 'orders_user_product_key');
    });
    expect(result.current.diagram.uniqueConstraints).toHaveLength(1);
    expect(result.current.diagram.uniqueConstraints[0].columnIds).toEqual(['c2', 'c3']);
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
      result.current.addIndex(tableId, { name: 'idx_email', columnIds: ['c2'] });
    });
    const indexId = result.current.diagram.tables[0].indexes[0].id;
    act(() => {
      result.current.updateIndex(tableId, indexId, {
        name: 'idx_user_email',
        columnIds: ['c3'],
      });
    });
    const table = result.current.diagram.tables.find((t) => t.id === tableId);
    expect(table?.indexes).toHaveLength(1);
    expect(table?.indexes[0].name).toBe('idx_user_email');
    expect(table?.indexes[0].columnIds).toEqual(['c3']);
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
        indexes: [],
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
        indexes: [],
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
      tables: [{ id: tableId, name: 'users', x: 0, y: 0, width: 220, height: 120, columns: [], indexes: [] }],
      uniqueConstraints: [constraint],
    };
    expect(findUniqueConstraintsByTable(updated, tableId)).toEqual([constraint]);
    expect(findUniqueConstraintsByTable(updated, 'nonexistent')).toEqual([]);
  });

  /* ---- TASK-009: column editing tests on the table model ---- */

  it('adds a column to a table', () => {
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
      result.current.addColumn(tableId, {
        name: 'id',
        dataType: 'integer',
        nullable: false,
        primaryKey: true,
      });
    });
    const table = result.current.diagram.tables.find((t) => t.id === tableId);
    expect(table?.columns).toHaveLength(1);
    expect(table?.columns[0].name).toBe('id');
    expect(table?.columns[0].dataType).toBe('integer');
    expect(table?.columns[0].nullable).toBe(false);
    expect(table?.columns[0].primaryKey).toBe(true);
    expect(table?.columns[0].id).toBeDefined();
  });

  it('adds a column with all optional properties', () => {
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
      result.current.addColumn(tableId, {
        name: 'created_at',
        dataType: 'timestamp',
        nullable: true,
        defaultValue: 'CURRENT_TIMESTAMP',
        primaryKey: false,
      });
    });
    const table = result.current.diagram.tables.find((t) => t.id === tableId);
    expect(table?.columns).toHaveLength(1);
    expect(table?.columns[0].name).toBe('created_at');
    expect(table?.columns[0].dataType).toBe('timestamp');
    expect(table?.columns[0].nullable).toBe(true);
    expect(table?.columns[0].primaryKey).toBe(false);
    expect(table?.columns[0].defaultValue).toBe('CURRENT_TIMESTAMP');
  });

  it('updates a column name', () => {
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
      result.current.updateColumn(tableId, 'c1', { name: 'user_id' });
    });
    const table = result.current.diagram.tables.find((t) => t.id === tableId);
    expect(table?.columns).toHaveLength(1);
    expect(table?.columns[0].name).toBe('user_id');
    expect(table?.columns[0].dataType).toBe('integer');
    expect(table?.columns[0].nullable).toBe(false);
    expect(table?.columns[0].primaryKey).toBe(true);
  });

  it('updates a column data type', () => {
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
      result.current.updateColumn(tableId, 'c1', { dataType: 'bigint' });
    });
    const table = result.current.diagram.tables.find((t) => t.id === tableId);
    expect(table?.columns[0].dataType).toBe('bigint');
    expect(table?.columns[0].name).toBe('id');
  });

  it('updates column nullable flag', () => {
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
      result.current.updateColumn(tableId, 'c1', { nullable: true });
    });
    const table = result.current.diagram.tables.find((t) => t.id === tableId);
    expect(table?.columns[0].nullable).toBe(true);
  });

  it('updates column primary key flag', () => {
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
      result.current.updateColumn(tableId, 'c1', { primaryKey: false });
    });
    const table = result.current.diagram.tables.find((t) => t.id === tableId);
    expect(table?.columns[0].primaryKey).toBe(false);
  });

  it('updates column default value', () => {
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
      result.current.updateColumn(tableId, 'c1', { defaultValue: '0' });
    });
    const table = result.current.diagram.tables.find((t) => t.id === tableId);
    expect(table?.columns[0].defaultValue).toBe('0');
  });

  it('clears column default value', () => {
    const { result } = renderHook(() => useDiagram());
    act(() => {
      result.current.addTable({
        name: 'users',
        x: 0,
        y: 0,
        width: 220,
        height: 120,
        columns: [
          { id: 'c1', name: 'id', dataType: 'integer', nullable: false, primaryKey: true, defaultValue: '0' },
        ],
        indexes: [],
      });
    });
    const tableId = result.current.diagram.tables[0].id;
    act(() => {
      result.current.updateColumn(tableId, 'c1', { defaultValue: undefined });
    });
    const table = result.current.diagram.tables.find((t) => t.id === tableId);
    expect(table?.columns[0].defaultValue).toBeUndefined();
  });

  it('removes a column from a table', () => {
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
      result.current.removeColumn(tableId, 'c1');
    });
    const table = result.current.diagram.tables.find((t) => t.id === tableId);
    expect(table?.columns).toHaveLength(1);
    expect(table?.columns[0].id).toBe('c2');
    expect(table?.columns[0].name).toBe('email');
  });

  it('removing a column removes associated indexes', () => {
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
      result.current.addIndex(tableId, { name: 'idx_email', columnIds: ['c2'] });
    });
    act(() => {
      result.current.removeColumn(tableId, 'c2');
    });
    const table = result.current.diagram.tables.find((t) => t.id === tableId);
    expect(table?.columns).toHaveLength(1);
    expect(table?.indexes).toHaveLength(0);
  });

  it('removing a column removes it from unique constraints', () => {
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
      result.current.addUniqueConstraint(tableId, ['c2'], 'users_email_key');
    });
    act(() => {
      result.current.removeColumn(tableId, 'c2');
    });
    const constraint = result.current.diagram.uniqueConstraints[0];
    expect(constraint).toBeDefined();
    expect(constraint.columnIds).not.toContain('c2');
    expect(constraint.columnIds).toEqual([]);
  });
});
