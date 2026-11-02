import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DiagramCanvas } from './DiagramCanvas';
import { createEmptyDiagram } from '../types/diagram';

describe('DiagramCanvas', () => {
  it('displays an empty canvas message when there are no tables', () => {
    render(
      <DiagramCanvas
        diagram={createEmptyDiagram()}
        onTablePositionUpdate={() => {}}
        onTableUpdate={() => {}}
      />,
    );
    const message = screen.getByText(
      /Empty diagram canvas/i,
    );
    expect(message).toBeInTheDocument();
  });

  it('renders table nodes when tables exist', () => {
    const diagram = createEmptyDiagram();
    diagram.tables.push({
      id: 'table-1',
      name: 'users',
      x: 50,
      y: 50,
      width: 220,
      height: 120,
      columns: [
        { id: 'c1', name: 'id', dataType: 'integer', nullable: false, primaryKey: true },
      ],
    });
    render(
      <DiagramCanvas
        diagram={diagram}
        onTablePositionUpdate={() => {}}
        onTableUpdate={() => {}}
      />,
    );
    expect(screen.getByText('users')).toBeInTheDocument();
    const nameInput = screen.getByLabelText('Column name');
    expect(nameInput).toHaveValue('id');
    const typeInput = screen.getByLabelText('Data type');
    expect(typeInput).toHaveValue('integer');
  });

  it('renders editable columns for each table column', () => {
    const diagram = createEmptyDiagram();
    diagram.tables.push({
      id: 'table-1',
      name: 'users',
      x: 50,
      y: 50,
      width: 220,
      height: 120,
      columns: [
        { id: 'c1', name: 'id', dataType: 'integer', nullable: false, primaryKey: true },
        { id: 'c2', name: 'email', dataType: 'text', nullable: true, primaryKey: false },
      ],
    });
    render(
      <DiagramCanvas
        diagram={diagram}
        onTablePositionUpdate={() => {}}
        onTableUpdate={() => {}}
      />,
    );
    expect(screen.getAllByLabelText('Column name')).toHaveLength(2);
    expect(screen.getAllByLabelText('Data type')).toHaveLength(2);
    expect(screen.getByLabelText('Add column')).toBeInTheDocument();
  });

  it('editing a column name invokes onTableUpdate', () => {
    const onTableUpdate = vi.fn();
    const diagram = createEmptyDiagram();
    diagram.tables.push({
      id: 'table-1',
      name: 'users',
      x: 50,
      y: 50,
      width: 220,
      height: 120,
      columns: [
        { id: 'c1', name: 'id', dataType: 'integer', nullable: false, primaryKey: true },
      ],
    });
    render(
      <DiagramCanvas
        diagram={diagram}
        onTablePositionUpdate={() => {}}
        onTableUpdate={onTableUpdate}
      />,
    );
    const nameInput = screen.getByLabelText('Column name');
    fireEvent.change(nameInput, { target: { value: 'identifier' } });
    expect(onTableUpdate).toHaveBeenCalled();
    const updated = onTableUpdate.mock.calls[0][0];
    expect(updated.columns[0]!.name).toBe('identifier');
  });

  it('does not show empty message when tables exist', () => {
    const diagram = createEmptyDiagram();
    diagram.tables.push({
      id: 'table-1',
      name: 'users',
      x: 50,
      y: 50,
      width: 220,
      height: 120,
      columns: [],
    });
    render(
      <DiagramCanvas
        diagram={diagram}
        onTablePositionUpdate={() => {}}
        onTableUpdate={() => {}}
      />,
    );
    expect(screen.queryByText(/Empty diagram canvas/i)).not.toBeInTheDocument();
  });

  it('renders relationship lines between tables', () => {
    const diagram = createEmptyDiagram();
    diagram.tables.push(
      {
        id: 'table-1',
        name: 'users',
        x: 0,
        y: 0,
        width: 220,
        height: 120,
        columns: [],
      },
      {
        id: 'table-2',
        name: 'orders',
        x: 300,
        y: 0,
        width: 220,
        height: 120,
        columns: [],
      },
    );
    diagram.relationships.push({
      id: 'rel-1',
      sourceTableId: 'table-1',
      targetTableId: 'table-2',
    });
    render(
      <DiagramCanvas
        diagram={diagram}
        onTablePositionUpdate={() => {}}
        onTableUpdate={() => {}}
      />,
    );
    expect(screen.getByText('users')).toBeInTheDocument();
    expect(screen.getByText('orders')).toBeInTheDocument();
  });
});
