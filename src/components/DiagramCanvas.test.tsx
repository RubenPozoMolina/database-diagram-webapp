import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DiagramCanvas } from './DiagramCanvas';
import { createEmptyDiagram } from '../types/diagram';

describe('DiagramCanvas', () => {
  it('displays an empty canvas message when there are no tables', () => {
    render(
      <DiagramCanvas
        diagram={createEmptyDiagram()}
        onTablePositionUpdate={() => {}}
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
      />,
    );
    expect(screen.getByText('users')).toBeInTheDocument();
    expect(screen.getByText(/id: integer/)).toBeInTheDocument();
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
      />,
    );
    expect(screen.getByText('users')).toBeInTheDocument();
    expect(screen.getByText('orders')).toBeInTheDocument();
  });
});
