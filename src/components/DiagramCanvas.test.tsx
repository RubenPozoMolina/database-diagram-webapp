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
        onTableUpdate={() => {}}
        onDeleteTable={() => {}}
        onDeleteRelationship={() => {}}
        onAddColumn={() => {}}
        onRemoveColumn={() => {}}
        onUpdateColumn={() => {}}
        onAddUniqueConstraint={() => {}}
        onRemoveUniqueConstraint={() => {}}
        onUpdateUniqueConstraint={() => {}}
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
      indexes: [],
    });
    render(
      <DiagramCanvas
        diagram={diagram}
        onTablePositionUpdate={() => {}}
        onTableUpdate={() => {}}
        onDeleteTable={() => {}}
        onDeleteRelationship={() => {}}
        onAddColumn={() => {}}
        onRemoveColumn={() => {}}
        onUpdateColumn={() => {}}
        onAddUniqueConstraint={() => {}}
        onRemoveUniqueConstraint={() => {}}
        onUpdateUniqueConstraint={() => {}}
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
      indexes: [],
    });
    render(
      <DiagramCanvas
        diagram={diagram}
        onTablePositionUpdate={() => {}}
        onTableUpdate={() => {}}
        onDeleteTable={() => {}}
        onDeleteRelationship={() => {}}
        onAddColumn={() => {}}
        onRemoveColumn={() => {}}
        onUpdateColumn={() => {}}
        onAddUniqueConstraint={() => {}}
        onRemoveUniqueConstraint={() => {}}
        onUpdateUniqueConstraint={() => {}}
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
        indexes: [],
      },
      {
        id: 'table-2',
        name: 'orders',
        x: 300,
        y: 0,
        width: 220,
        height: 120,
        columns: [],
        indexes: [],
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
        onDeleteTable={() => {}}
        onDeleteRelationship={() => {}}
        onAddColumn={() => {}}
        onRemoveColumn={() => {}}
        onUpdateColumn={() => {}}
        onAddUniqueConstraint={() => {}}
        onRemoveUniqueConstraint={() => {}}
        onUpdateUniqueConstraint={() => {}}
      />,
    );
    expect(screen.getByText('users')).toBeInTheDocument();
    expect(screen.getByText('orders')).toBeInTheDocument();
  });

  /* ---- TASK-013: column-aware relationship lines ---- */

  it('uses table centres as line endpoints when no column positions are provided', () => {
    const diagram = createEmptyDiagram();
    diagram.tables.push(
      {
        id: 'table-1',
        name: 'users',
        x: 100,
        y: 100,
        width: 220,
        height: 120,
        columns: [
          { id: 'c1', name: 'id', dataType: 'integer', nullable: false, primaryKey: true },
        ],
        indexes: [],
      },
      {
        id: 'table-2',
        name: 'orders',
        x: 400,
        y: 100,
        width: 220,
        height: 120,
        columns: [
          { id: 'c2', name: 'order_id', dataType: 'integer', nullable: false, primaryKey: true },
        ],
        indexes: [],
      },
    );
    diagram.relationships.push({
      id: 'rel-1',
      sourceTableId: 'table-1',
      sourceColumnId: 'c1',
      targetTableId: 'table-2',
      targetColumnId: 'c2',
    });
    render(
      <DiagramCanvas
        diagram={diagram}
        onTablePositionUpdate={() => {}}
        onTableUpdate={() => {}}
        onDeleteTable={() => {}}
        onDeleteRelationship={() => {}}
        onAddColumn={() => {}}
        onRemoveColumn={() => {}}
        onUpdateColumn={() => {}}
        onAddUniqueConstraint={() => {}}
        onRemoveUniqueConstraint={() => {}}
        onUpdateUniqueConstraint={() => {}}
      />,
    );
    const path = document.querySelector('.relationship-line') as SVGPathElement;
    expect(path).not.toBeNull();
    // Without column positions, line goes from bottom-center of source to top-center of target.
    // Path format: M sx sy C cp1x cp1y cp2x cp2y tx ty
    const d = path.getAttribute('d');
    expect(d).toContain('M 210 220'); // source bottom-center: x + width/2, y + height
    expect(d).toContain('510 100');   // target top-center: x + width/2, y
  });

  it('anchors relationship line to source and target column positions when provided', () => {
    const diagram = createEmptyDiagram();
    diagram.tables.push(
      {
        id: 'table-1',
        name: 'users',
        x: 100,
        y: 100,
        width: 220,
        height: 120,
        columns: [
          { id: 'c1', name: 'id', dataType: 'integer', nullable: false, primaryKey: true },
        ],
        indexes: [],
      },
      {
        id: 'table-2',
        name: 'orders',
        x: 400,
        y: 100,
        width: 220,
        height: 120,
        columns: [
          { id: 'c2', name: 'order_id', dataType: 'integer', nullable: false, primaryKey: true },
        ],
        indexes: [],
      },
    );
    diagram.relationships.push({
      id: 'rel-1',
      sourceTableId: 'table-1',
      sourceColumnId: 'c1',
      targetTableId: 'table-2',
      targetColumnId: 'c2',
    });

    const columnPositions = new Map<string, Map<string, { x: number; y: number }>>();
    columnPositions.set('table-1', new Map([['c1', { x: 150, y: 200 }]]));
    columnPositions.set('table-2', new Map([['c2', { x: 450, y: 150 }]]));

    render(
      <DiagramCanvas
        diagram={diagram}
        onTablePositionUpdate={() => {}}
        onTableUpdate={() => {}}
        onDeleteTable={() => {}}
        onDeleteRelationship={() => {}}
        onAddColumn={() => {}}
        onRemoveColumn={() => {}}
        onUpdateColumn={() => {}}
        columnPositions={columnPositions}
        onAddUniqueConstraint={() => {}}
        onRemoveUniqueConstraint={() => {}}
        onUpdateUniqueConstraint={() => {}}
      />,
    );
    const path = document.querySelector('.relationship-line') as SVGPathElement;
    expect(path).not.toBeNull();
    const d = path.getAttribute('d');
    expect(d).toContain('M 150 200'); // source column position
    expect(d).toContain('450 150');   // target column position
  });

  /* ---- TASK-041: imported schema rendering ---- */

  it('uses actual table dimensions for relationship line endpoints (not hardcoded defaults)', () => {
    const diagram = createEmptyDiagram();
    // Imported tables often have heights larger than the default 120px due to many columns.
    diagram.tables.push(
      {
        id: 'table-1',
        name: 'users',
        x: 100,
        y: 100,
        width: 240,
        height: 308, // simulates an imported table with ~10 columns
        columns: [],
        indexes: [],
      },
      {
        id: 'table-2',
        name: 'orders',
        x: 500,
        y: 100,
        width: 240,
        height: 200, // simulates an imported table with ~6 columns
        columns: [],
        indexes: [],
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
        onDeleteTable={() => {}}
        onDeleteRelationship={() => {}}
        onAddColumn={() => {}}
        onRemoveColumn={() => {}}
        onUpdateColumn={() => {}}
        onAddUniqueConstraint={() => {}}
        onRemoveUniqueConstraint={() => {}}
        onUpdateUniqueConstraint={() => {}}
      />,
    );
    const path = document.querySelector('.relationship-line') as SVGPathElement;
    expect(path).not.toBeNull();
    const d = path.getAttribute('d');
    // Source bottom-center: x + width/2 = 100 + 240/2 = 220, y + height = 100 + 308 = 408
    expect(d).toContain('M 220 408');
    // Target top-center: x + width/2 = 500 + 240/2 = 620, y = 100
    expect(d).toContain('620 100');
  });

  it('renders imported schema with tables, columns, relationships, indexes and unique constraints', () => {
    const diagram = createEmptyDiagram();
    diagram.name = 'Imported Schema';
    diagram.tables.push({
      id: 'table-1',
      name: 'customers',
      x: 100,
      y: 100,
      width: 240,
      height: 148,
      columns: [
        { id: 'c1', name: 'customer_id', dataType: 'integer', nullable: false, primaryKey: true },
        { id: 'c2', name: 'email', dataType: 'text', nullable: false, primaryKey: false },
      ],
      indexes: [{ id: 'i1', tableId: 'table-1', name: 'idx_email', columnIds: ['c2'] }],
    });
    diagram.tables.push({
      id: 'table-2',
      name: 'orders',
      x: 400,
      y: 100,
      width: 240,
      height: 174,
      columns: [
        { id: 'c3', name: 'order_id', dataType: 'integer', nullable: false, primaryKey: true },
        { id: 'c4', name: 'customer_id', dataType: 'integer', nullable: false, primaryKey: false },
        { id: 'c5', name: 'total', dataType: 'numeric', nullable: true, primaryKey: false },
      ],
      indexes: [],
    });
    diagram.relationships.push({
      id: 'rel-1',
      sourceTableId: 'table-1',
      sourceColumnId: 'c1',
      targetTableId: 'table-2',
      targetColumnId: 'c4',
    });
    diagram.uniqueConstraints.push({
      id: 'uc1',
      tableId: 'table-1',
      columnIds: ['c2'],
      name: 'customers_email_key',
    });

    render(
      <DiagramCanvas
        diagram={diagram}
        onTablePositionUpdate={() => {}}
        onTableUpdate={() => {}}
        onDeleteTable={() => {}}
        onDeleteRelationship={() => {}}
        onAddColumn={() => {}}
        onRemoveColumn={() => {}}
        onUpdateColumn={() => {}}
        onAddUniqueConstraint={() => {}}
        onRemoveUniqueConstraint={() => {}}
        onUpdateUniqueConstraint={() => {}}
      />,
    );
    // Tables are rendered.
    expect(screen.getByText('customers')).toBeInTheDocument();
    expect(screen.getByText('orders')).toBeInTheDocument();
    // Columns and data types are displayed.
    // customer_id: integer appears in both tables (customers PK, orders FK).
    expect(screen.getAllByText(/customer_id: integer/)).toHaveLength(2);
    expect(screen.getByText(/email: text/)).toBeInTheDocument();
    expect(screen.getByText(/order_id: integer/)).toBeInTheDocument();
    expect(screen.getByText(/total: numeric/)).toBeInTheDocument();
    // Relationship line is drawn.
    const path = document.querySelector('.relationship-line');
    expect(path).not.toBeNull();
    // Indexes section is present (once per table).
    expect(screen.getAllByText('Indexes')).toHaveLength(2);
    expect(screen.getByText('idx_email')).toBeInTheDocument();
  });

  it('falls back to table centres when column position is missing for a column', () => {
    const diagram = createEmptyDiagram();
    diagram.tables.push(
      {
        id: 'table-1',
        name: 'users',
        x: 100,
        y: 100,
        width: 220,
        height: 120,
        columns: [
          { id: 'c1', name: 'id', dataType: 'integer', nullable: false, primaryKey: true },
        ],
        indexes: [],
      },
      {
        id: 'table-2',
        name: 'orders',
        x: 400,
        y: 100,
        width: 220,
        height: 120,
        columns: [
          { id: 'c2', name: 'order_id', dataType: 'integer', nullable: false, primaryKey: true },
        ],
        indexes: [],
      },
    );
    diagram.relationships.push({
      id: 'rel-1',
      sourceTableId: 'table-1',
      sourceColumnId: 'c1',
      targetTableId: 'table-2',
      targetColumnId: 'c2',
    });

    // Provide column positions only for the source table, not the target.
    const columnPositions = new Map<string, Map<string, { x: number; y: number }>>();
    columnPositions.set('table-1', new Map([['c1', { x: 150, y: 200 }]]));
    // table-2 positions are missing -> should fall back to table centre

    render(
      <DiagramCanvas
        diagram={diagram}
        onTablePositionUpdate={() => {}}
        onTableUpdate={() => {}}
        onDeleteTable={() => {}}
        onDeleteRelationship={() => {}}
        onAddColumn={() => {}}
        onRemoveColumn={() => {}}
        onUpdateColumn={() => {}}
        columnPositions={columnPositions}
        onAddUniqueConstraint={() => {}}
        onRemoveUniqueConstraint={() => {}}
        onUpdateUniqueConstraint={() => {}}
      />,
    );
    const path = document.querySelector('.relationship-line') as SVGPathElement;
    expect(path).not.toBeNull();
    const d = path.getAttribute('d');
    // Source uses column position (150, 200), target falls back to table centre (510, 100).
    expect(d).toContain('M 150 200');
    expect(d).toContain('510 100');
  });
});
