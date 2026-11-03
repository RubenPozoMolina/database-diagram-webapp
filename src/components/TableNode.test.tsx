import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TableNode } from './TableNode';
import type { Column, Table } from '../types/diagram';

const makeColumn = (overrides: Partial<Column> = {}): Column => ({
  id: 'c1',
  name: 'id',
  dataType: 'integer',
  nullable: false,
  primaryKey: true,
  ...overrides,
});

const makeTable = (overrides: Partial<Table> = {}): Table => ({
  id: 't1',
  name: 'users',
  x: 0,
  y: 0,
  width: 220,
  height: 120,
  columns: [makeColumn()],
  ...overrides,
});

const renderTableNode = (table = makeTable()) =>
  render(
    <TableNode
      table={table}
      onUpdatePosition={vi.fn()}
      onUpdateTable={vi.fn()}
    />,
  );

describe('TableNode', () => {
  it('renders the table name and its columns', () => {
    renderTableNode();
    expect(screen.getByText('users')).toBeInTheDocument();
    expect(screen.getByText(/id: integer/)).toBeInTheDocument();
  });

  it('exposes the table name as an accessible region label', () => {
    renderTableNode();
    expect(
      screen.getByRole('region', { name: 'Table users' }),
    ).toBeInTheDocument();
  });

  it('makes the table name editable on double click and saves on Enter', () => {
    const onUpdateTable = vi.fn();
    render(
      <TableNode
        table={makeTable()}
        onUpdatePosition={vi.fn()}
        onUpdateTable={onUpdateTable}
      />,
    );
    fireEvent.doubleClick(screen.getByText('users'));
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'customers' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onUpdateTable).toHaveBeenCalledWith('t1', { name: 'customers' });
  });

  it('cancels table name editing on Escape without calling onUpdateTable', () => {
    const onUpdateTable = vi.fn();
    render(
      <TableNode
        table={makeTable()}
        onUpdatePosition={vi.fn()}
        onUpdateTable={onUpdateTable}
      />,
    );
    fireEvent.doubleClick(screen.getByText('users'));
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'changed' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onUpdateTable).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('makes a column editable on double click and updates name and type', () => {
    const onUpdateTable = vi.fn();
    render(
      <TableNode
        table={makeTable()}
        onUpdatePosition={vi.fn()}
        onUpdateTable={onUpdateTable}
      />,
    );
    fireEvent.doubleClick(screen.getByText(/id: integer/));
    const nameInput = screen.getAllByRole('textbox')[0];
    fireEvent.change(nameInput, { target: { value: 'user_id' } });
    fireEvent.blur(nameInput);
    expect(onUpdateTable).toHaveBeenCalledWith('t1', {
      columns: expect.arrayContaining([
        expect.objectContaining({ name: 'user_id', dataType: 'integer' }),
      ]),
    });
  });

  it('changes a column data type via the select', () => {
    const onUpdateTable = vi.fn();
    render(
      <TableNode
        table={makeTable()}
        onUpdatePosition={vi.fn()}
        onUpdateTable={onUpdateTable}
      />,
    );
    fireEvent.doubleClick(screen.getByText(/id: integer/));
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'text' } });
    fireEvent.blur(selects[0]);
    expect(onUpdateTable).toHaveBeenCalledWith('t1', {
      columns: expect.arrayContaining([
        expect.objectContaining({ name: 'id', dataType: 'text' }),
      ]),
    });
  });

  it('toggles a column nullable flag via the checkbox', () => {
    const onUpdateTable = vi.fn();
    render(
      <TableNode
        table={makeTable()}
        onUpdatePosition={vi.fn()}
        onUpdateTable={onUpdateTable}
      />,
    );
    fireEvent.doubleClick(screen.getByText(/id: integer/));
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    fireEvent.blur(screen.getAllByRole('textbox')[0]);
    expect(onUpdateTable).toHaveBeenCalledWith('t1', {
      columns: expect.arrayContaining([
        expect.objectContaining({
          name: 'id',
          dataType: 'integer',
          nullable: true,
        }),
      ]),
    });
  });

  it('edits a column default value', () => {
    const onUpdateTable = vi.fn();
    render(
      <TableNode
        table={makeTable()}
        onUpdatePosition={vi.fn()}
        onUpdateTable={onUpdateTable}
      />,
    );
    fireEvent.doubleClick(screen.getByText(/id: integer/));
    const defaultInput = screen.getByPlaceholderText('default value');
    fireEvent.change(defaultInput, {
      target: { value: 'CURRENT_TIMESTAMP' },
    });
    fireEvent.blur(screen.getAllByRole('textbox')[0]);
    expect(onUpdateTable).toHaveBeenCalledWith('t1', {
      columns: expect.arrayContaining([
        expect.objectContaining({
          name: 'id',
          dataType: 'integer',
          defaultValue: 'CURRENT_TIMESTAMP',
        }),
      ]),
    });
  });

  it('clears a column default value when the input is emptied', () => {
    const onUpdateTable = vi.fn();
    render(
      <TableNode
        table={
          makeTable({
            columns: [
              makeColumn({
                name: 'created_at',
                dataType: 'timestamp',
                nullable: false,
                defaultValue: 'CURRENT_TIMESTAMP',
              }),
            ],
          })
        }
        onUpdatePosition={vi.fn()}
        onUpdateTable={onUpdateTable}
      />,
    );
    fireEvent.doubleClick(screen.getByText(/created_at: timestamp/));
    const defaultInput = screen.getByPlaceholderText('default value');
    fireEvent.change(defaultInput, { target: { value: '' } });
    fireEvent.blur(screen.getAllByRole('textbox')[0]);
    expect(onUpdateTable).toHaveBeenCalledWith('t1', {
      columns: expect.arrayContaining([
        expect.objectContaining({
          name: 'created_at',
          dataType: 'timestamp',
          defaultValue: undefined,
        }),
      ]),
    });
  });

  it('adds a new column to the table and opens it for editing', () => {
    // crypto.randomUUID exists in the Node test runtime; override it
    // unconditionally so the new column id is deterministic.
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: { randomUUID: () => 'test-column-uuid' },
    });
    const onUpdateTable = vi.fn();
    render(
      <TableNode
        table={makeTable()}
        onUpdatePosition={vi.fn()}
        onUpdateTable={onUpdateTable}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: /add a new column to this table/i,
      }),
    );
    expect(onUpdateTable).toHaveBeenCalledWith('t1', {
      columns: expect.arrayContaining([
        expect.objectContaining({
          id: 'test-column-uuid',
          name: 'new_column',
          dataType: 'text',
          nullable: true,
          primaryKey: false,
        }),
      ]),
    });
  });

  it('removes a column from the table', () => {
    const onUpdateTable = vi.fn();
    render(
      <TableNode
        table={
          makeTable({
            columns: [
              makeColumn({ id: 'c1', name: 'id', dataType: 'integer' }),
              makeColumn({ id: 'c2', name: 'email', dataType: 'varchar' }),
            ],
          })
        }
        onUpdatePosition={vi.fn()}
        onUpdateTable={onUpdateTable}
      />,
    );
    fireEvent.doubleClick(screen.getByText(/id: integer/));
    fireEvent.click(screen.getByRole('button', { name: /Remove column id/i }));
    expect(onUpdateTable).toHaveBeenCalledWith('t1', {
      columns: expect.not.arrayContaining([
        expect.objectContaining({ name: 'id', dataType: 'integer' }),
      ]),
    });
    expect(onUpdateTable).toHaveBeenCalledWith('t1', {
      columns: expect.arrayContaining([
        expect.objectContaining({ name: 'email', dataType: 'varchar' }),
      ]),
    });
  });
});
