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

  it('toggles column nullable via the checkbox', () => {
    const onUpdateTable = vi.fn();
    render(
      <TableNode
        table={makeTable({ columns: [makeColumn({ nullable: false })] })}
        onUpdatePosition={vi.fn()}
        onUpdateTable={onUpdateTable}
      />,
    );
    fireEvent.doubleClick(screen.getByText(/id: integer/));
    const checkbox = screen.getByRole('checkbox', {
      name: 'Nullable for id',
    });
    fireEvent.click(checkbox);
    fireEvent.blur(checkbox);
    expect(onUpdateTable).toHaveBeenCalledWith('t1', {
      columns: expect.arrayContaining([
        expect.objectContaining({ name: 'id', nullable: true }),
      ]),
    });
  });

  it('edits column default value via the text input', () => {
    const onUpdateTable = vi.fn();
    render(
      <TableNode
        table={makeTable()}
        onUpdatePosition={vi.fn()}
        onUpdateTable={onUpdateTable}
      />,
    );
    fireEvent.doubleClick(screen.getByText(/id: integer/));
    const inputs = screen.getAllByRole('textbox');
    const defaultInput = inputs[inputs.length - 1];
    fireEvent.change(defaultInput, { target: { value: '0' } });
    fireEvent.blur(defaultInput);
    expect(onUpdateTable).toHaveBeenCalledWith('t1', {
      columns: expect.arrayContaining([
        expect.objectContaining({ name: 'id', defaultValue: '0' }),
      ]),
    });
  });

  it('clears column default value when input is emptied', () => {
    const onUpdateTable = vi.fn();
    render(
      <TableNode
        table={
          makeTable({
            columns: [makeColumn({ defaultValue: '0' })],
          })
        }
        onUpdatePosition={vi.fn()}
        onUpdateTable={onUpdateTable}
      />,
    );
    fireEvent.doubleClick(screen.getByText(/id: integer/));
    const inputs = screen.getAllByRole('textbox');
    const defaultInput = inputs[inputs.length - 1];
    fireEvent.change(defaultInput, { target: { value: '' } });
    fireEvent.blur(defaultInput);
    expect(onUpdateTable).toHaveBeenCalledWith('t1', {
      columns: expect.arrayContaining([
        expect.objectContaining({ name: 'id', defaultValue: undefined }),
      ]),
    });
  });
});
