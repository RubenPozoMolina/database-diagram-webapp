import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TableNode } from './TableNode';
import type { Column, Table, UniqueConstraint } from '../types/diagram';

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
  indexes: [],
  ...overrides,
});

const renderTableNode = (table = makeTable()) =>
  render(
    <TableNode
      table={table}
      onUpdatePosition={vi.fn()}
      onUpdateTable={vi.fn()}
      onAddColumn={vi.fn()}
      onRemoveColumn={vi.fn()}
    onAddUniqueConstraint={vi.fn()}
    onRemoveUniqueConstraint={vi.fn()}
    onUpdateUniqueConstraint={vi.fn()}
      onUpdateColumn={vi.fn()}
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
        onAddColumn={vi.fn()}
        onRemoveColumn={vi.fn()}
      onAddUniqueConstraint={vi.fn()}
      onRemoveUniqueConstraint={vi.fn()}
      onUpdateUniqueConstraint={vi.fn()}
        onUpdateColumn={vi.fn()}
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
        onAddColumn={vi.fn()}
        onRemoveColumn={vi.fn()}
      onAddUniqueConstraint={vi.fn()}
      onRemoveUniqueConstraint={vi.fn()}
      onUpdateUniqueConstraint={vi.fn()}
        onUpdateColumn={vi.fn()}
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
    const onUpdateColumn = vi.fn();
    render(
      <TableNode
        table={makeTable()}
        onUpdatePosition={vi.fn()}
        onUpdateTable={vi.fn()}
        onAddColumn={vi.fn()}
        onRemoveColumn={vi.fn()}
      onAddUniqueConstraint={vi.fn()}
      onRemoveUniqueConstraint={vi.fn()}
      onUpdateUniqueConstraint={vi.fn()}
        onUpdateColumn={onUpdateColumn}
      />,
    );
    fireEvent.doubleClick(screen.getByText(/id: integer/));
    const nameInput = screen.getAllByRole('textbox')[0];
    fireEvent.change(nameInput, { target: { value: 'user_id' } });
    fireEvent.blur(nameInput);
    expect(onUpdateColumn).toHaveBeenCalledWith('t1', 'c1', {
      name: 'user_id',
    });
  });

  it('changes a column data type via the select', () => {
    const onUpdateColumn = vi.fn();
    render(
      <TableNode
        table={makeTable()}
        onUpdatePosition={vi.fn()}
        onUpdateTable={vi.fn()}
        onAddColumn={vi.fn()}
        onRemoveColumn={vi.fn()}
      onAddUniqueConstraint={vi.fn()}
      onRemoveUniqueConstraint={vi.fn()}
      onUpdateUniqueConstraint={vi.fn()}
        onUpdateColumn={onUpdateColumn}
      />,
    );
    fireEvent.doubleClick(screen.getByText(/id: integer/));
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'text' } });
    fireEvent.blur(selects[0]);
    expect(onUpdateColumn).toHaveBeenCalledWith('t1', 'c1', {
      dataType: 'text',
    });
  });

  it('toggles column nullable via the checkbox', () => {
    const onUpdateColumn = vi.fn();
    render(
      <TableNode
        table={makeTable({ columns: [makeColumn({ nullable: false })] })}
        onUpdatePosition={vi.fn()}
        onUpdateTable={vi.fn()}
        onAddColumn={vi.fn()}
        onRemoveColumn={vi.fn()}
      onAddUniqueConstraint={vi.fn()}
      onRemoveUniqueConstraint={vi.fn()}
      onUpdateUniqueConstraint={vi.fn()}
        onUpdateColumn={onUpdateColumn}
      />,
    );
    fireEvent.doubleClick(screen.getByText(/id: integer/));
    const checkbox = screen.getByRole('checkbox', {
      name: 'Nullable for id',
    });
    fireEvent.click(checkbox);
    fireEvent.blur(checkbox);
    expect(onUpdateColumn).toHaveBeenCalledWith('t1', 'c1', {
      nullable: true,
    });
  });

  it('toggles a column nullable flag via the checkbox', () => {
    const onUpdateColumn = vi.fn();
    render(
      <TableNode
        table={makeTable()}
        onUpdatePosition={vi.fn()}
        onUpdateTable={vi.fn()}
        onAddColumn={vi.fn()}
        onRemoveColumn={vi.fn()}
      onAddUniqueConstraint={vi.fn()}
      onRemoveUniqueConstraint={vi.fn()}
      onUpdateUniqueConstraint={vi.fn()}
        onUpdateColumn={onUpdateColumn}
      />,
    );
    fireEvent.doubleClick(screen.getByText(/id: integer/));
    const checkbox = screen.getByRole('checkbox', {
      name: 'Nullable for id',
    });
    fireEvent.click(checkbox);
    fireEvent.blur(screen.getAllByRole('textbox')[0]);
    expect(onUpdateColumn).toHaveBeenCalledWith('t1', 'c1', {
      nullable: true,
    });
  });

  it('toggles column primary key via the checkbox', () => {
    const onUpdateColumn = vi.fn();
    render(
      <TableNode
        table={makeTable({ columns: [makeColumn({ primaryKey: false })] })}
        onUpdatePosition={vi.fn()}
        onUpdateTable={vi.fn()}
        onAddColumn={vi.fn()}
        onRemoveColumn={vi.fn()}
      onAddUniqueConstraint={vi.fn()}
      onRemoveUniqueConstraint={vi.fn()}
      onUpdateUniqueConstraint={vi.fn()}
        onUpdateColumn={onUpdateColumn}
      />,
    );
    fireEvent.doubleClick(screen.getByText(/id: integer/));
    const checkbox = screen.getByRole('checkbox', {
      name: 'Primary key for id',
    });
    fireEvent.click(checkbox);
    fireEvent.blur(screen.getAllByRole('textbox')[0]);
    expect(onUpdateColumn).toHaveBeenCalledWith('t1', 'c1', {
      primaryKey: true,
    });
  });

  it('edits column default value via the text input', () => {
    const onUpdateColumn = vi.fn();
    render(
      <TableNode
        table={makeTable()}
        onUpdatePosition={vi.fn()}
        onUpdateTable={vi.fn()}
        onAddColumn={vi.fn()}
        onRemoveColumn={vi.fn()}
      onAddUniqueConstraint={vi.fn()}
      onRemoveUniqueConstraint={vi.fn()}
      onUpdateUniqueConstraint={vi.fn()}
        onUpdateColumn={onUpdateColumn}
      />,
    );
    fireEvent.doubleClick(screen.getByText(/id: integer/));
    const inputs = screen.getAllByRole('textbox');
    const defaultInput = inputs[inputs.length - 1];
    fireEvent.change(defaultInput, { target: { value: '0' } });
    fireEvent.blur(defaultInput);
    expect(onUpdateColumn).toHaveBeenCalledWith('t1', 'c1', {
      defaultValue: '0',
    });
  });

  it('edits a column default value', () => {
    const onUpdateColumn = vi.fn();
    render(
      <TableNode
        table={makeTable()}
        onUpdatePosition={vi.fn()}
        onUpdateTable={vi.fn()}
        onAddColumn={vi.fn()}
        onRemoveColumn={vi.fn()}
      onAddUniqueConstraint={vi.fn()}
      onRemoveUniqueConstraint={vi.fn()}
      onUpdateUniqueConstraint={vi.fn()}
        onUpdateColumn={onUpdateColumn}
      />,
    );
    fireEvent.doubleClick(screen.getByText(/id: integer/));
    const defaultInput = screen.getByPlaceholderText('Default');
    fireEvent.change(defaultInput, {
      target: { value: 'CURRENT_TIMESTAMP' },
    });
    fireEvent.blur(screen.getAllByRole('textbox')[0]);
    expect(onUpdateColumn).toHaveBeenCalledWith('t1', 'c1', {
      defaultValue: 'CURRENT_TIMESTAMP',
    });
  });

  it('clears column default value when input is emptied', () => {
    const onUpdateColumn = vi.fn();
    render(
      <TableNode
        table={makeTable({ columns: [makeColumn({ defaultValue: '0' })] })}
        onUpdatePosition={vi.fn()}
        onUpdateTable={vi.fn()}
        onAddColumn={vi.fn()}
        onRemoveColumn={vi.fn()}
      onAddUniqueConstraint={vi.fn()}
      onRemoveUniqueConstraint={vi.fn()}
      onUpdateUniqueConstraint={vi.fn()}
        onUpdateColumn={onUpdateColumn}
      />,
    );
    fireEvent.doubleClick(screen.getByText(/id: integer/));
    const inputs = screen.getAllByRole('textbox');
    const defaultInput = inputs[inputs.length - 1];
    fireEvent.change(defaultInput, { target: { value: '' } });
    fireEvent.blur(defaultInput);
    expect(onUpdateColumn).toHaveBeenCalledWith('t1', 'c1', {
      defaultValue: undefined,
    });
  });

  it('clears a column default value when the input is emptied', () => {
    const onUpdateColumn = vi.fn();
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
        onUpdateTable={vi.fn()}
        onAddColumn={vi.fn()}
        onRemoveColumn={vi.fn()}
      onAddUniqueConstraint={vi.fn()}
      onRemoveUniqueConstraint={vi.fn()}
      onUpdateUniqueConstraint={vi.fn()}
        onUpdateColumn={onUpdateColumn}
      />,
    );
    fireEvent.doubleClick(screen.getByText(/created_at: timestamp/));
    const defaultInput = screen.getByPlaceholderText('Default');
    fireEvent.change(defaultInput, { target: { value: '' } });
    fireEvent.blur(screen.getAllByRole('textbox')[0]);
    expect(onUpdateColumn).toHaveBeenCalledWith('t1', 'c1', {
      defaultValue: undefined,
    });
  });

  it('adds a new column to the table and opens it for editing', () => {
    // crypto.randomUUID exists in the Node test runtime; override it
    // unconditionally so the new column id is deterministic.
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: { randomUUID: () => 'test-column-uuid' },
    });
    const onAddColumn = vi.fn();
    render(
      <TableNode
        table={makeTable()}
        onUpdatePosition={vi.fn()}
        onUpdateTable={vi.fn()}
        onAddColumn={onAddColumn}
        onRemoveColumn={vi.fn()}
      onAddUniqueConstraint={vi.fn()}
      onRemoveUniqueConstraint={vi.fn()}
      onUpdateUniqueConstraint={vi.fn()}
        onUpdateColumn={vi.fn()}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: /add a new column to this table/i,
      }),
    );
    expect(onAddColumn).toHaveBeenCalledWith('t1', {
      name: 'new_column',
      dataType: 'text',
      nullable: true,
      primaryKey: false,
    });
  });

  it('removes a column from the table', () => {
    const onRemoveColumn = vi.fn();
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
        onUpdateTable={vi.fn()}
        onAddColumn={vi.fn()}
        onRemoveColumn={onRemoveColumn}
      onAddUniqueConstraint={vi.fn()}
      onRemoveUniqueConstraint={vi.fn()}
      onUpdateUniqueConstraint={vi.fn()}
        onUpdateColumn={vi.fn()}
      />,
    );
    fireEvent.doubleClick(screen.getByText(/id: integer/));
    fireEvent.click(screen.getByRole('button', { name: /Remove column id/i }));
    expect(onRemoveColumn).toHaveBeenCalledWith('t1', 'c1');
  });

  /* ---- STORY-007: index tests ---- */

  /* ---- STORY-004 / TASK-010: primary key badge tests ---- */

  it('shows a PK badge with key icon next to primary key columns', () => {
    const onUpdateTable = vi.fn();
    render(
      <TableNode
        table={
          makeTable({
            columns: [
              makeColumn({ id: 'c1', name: 'id', dataType: 'integer' }),
              makeColumn({ id: 'c2', name: 'email', dataType: 'varchar', primaryKey: false }),
            ],
          })
        }
        onUpdatePosition={vi.fn()}
        onUpdateTable={onUpdateTable}
        onAddColumn={vi.fn()}
        onRemoveColumn={vi.fn()}
      onAddUniqueConstraint={vi.fn()}
      onRemoveUniqueConstraint={vi.fn()}
      onUpdateUniqueConstraint={vi.fn()}
        onUpdateColumn={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Primary key')).toBeInTheDocument();
    expect(screen.getByText(/🔑 PK/)).toBeInTheDocument();
  });

  it('does not show a PK badge on non-primary-key columns', () => {
    const onUpdateTable = vi.fn();
    render(
      <TableNode
        table={
          makeTable({
            columns: [
              makeColumn({ id: 'c1', name: 'id', dataType: 'integer', primaryKey: false }),
            ],
          })
        }
        onUpdatePosition={vi.fn()}
        onUpdateTable={onUpdateTable}
        onAddColumn={vi.fn()}
        onRemoveColumn={vi.fn()}
      onAddUniqueConstraint={vi.fn()}
      onRemoveUniqueConstraint={vi.fn()}
      onUpdateUniqueConstraint={vi.fn()}
        onUpdateColumn={vi.fn()}
      />,
    );
    expect(screen.queryByTitle(/Primary key/)).toBeNull();
    expect(screen.queryByText(/🔑 PK/)).toBeNull();
  });

  it('shows an IX badge on indexed columns', () => {
    const onUpdateTable = vi.fn();
    render(
      <TableNode
        table={
          makeTable({
            columns: [makeColumn({ id: 'c1', name: 'id', dataType: 'integer' })],
            indexes: [{ id: 'i1', name: 'idx_id', columnId: 'c1' }],
          })
        }
        onUpdatePosition={vi.fn()}
        onUpdateTable={onUpdateTable}
        onAddColumn={vi.fn()}
        onRemoveColumn={vi.fn()}
      onAddUniqueConstraint={vi.fn()}
      onRemoveUniqueConstraint={vi.fn()}
      onUpdateUniqueConstraint={vi.fn()}
        onUpdateColumn={vi.fn()}
      />,
    );
    expect(screen.getByTitle(/IX/)).toBeInTheDocument();
    expect(screen.getByText(/id: integer/)).toBeInTheDocument();
  });

  it('renders the indexes section when indexes exist', () => {
    const onUpdateTable = vi.fn();
    render(
      <TableNode
        table={
          makeTable({
            columns: [makeColumn({ id: 'c1', name: 'id', dataType: 'integer' })],
            indexes: [{ id: 'i1', name: 'idx_id', columnId: 'c1' }],
          })
        }
        onUpdatePosition={vi.fn()}
        onUpdateTable={onUpdateTable}
        onAddColumn={vi.fn()}
        onRemoveColumn={vi.fn()}
      onAddUniqueConstraint={vi.fn()}
      onRemoveUniqueConstraint={vi.fn()}
      onUpdateUniqueConstraint={vi.fn()}
        onUpdateColumn={vi.fn()}
      />,
    );
    expect(screen.getByText('Indexes')).toBeInTheDocument();
    expect(screen.getByText('idx_id')).toBeInTheDocument();
    expect(screen.getByText(/on id/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Remove index idx_id/i }),
    ).toBeInTheDocument();
  });

  it('renders the indexes section and Add index button even when there are no indexes', () => {
    const onUpdateTable = vi.fn();
    render(
      <TableNode
        table={makeTable()}
        uniqueConstraints={[]}
        onUpdatePosition={vi.fn()}
        onUpdateTable={onUpdateTable}
        onAddColumn={vi.fn()}
        onRemoveColumn={vi.fn()}
      onAddUniqueConstraint={vi.fn()}
      onRemoveUniqueConstraint={vi.fn()}
      onUpdateUniqueConstraint={vi.fn()}
        onUpdateColumn={vi.fn()}
      />,
    );
    expect(screen.getByText('Indexes')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /add a new index to this table/i }),
    ).toBeInTheDocument();
  });

  it('adds a new index when Add index is clicked and form is submitted', () => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: { randomUUID: () => 'test-index-uuid' },
    });
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
        uniqueConstraints={[]}
        onUpdatePosition={vi.fn()}
        onUpdateTable={onUpdateTable}
        onAddColumn={vi.fn()}
        onRemoveColumn={vi.fn()}
      onAddUniqueConstraint={vi.fn()}
      onRemoveUniqueConstraint={vi.fn()}
      onUpdateUniqueConstraint={vi.fn()}
        onUpdateColumn={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /add a new index to this table/i }));
    const nameInput = screen.getByPlaceholderText('Index name');
    fireEvent.change(nameInput, { target: { value: 'idx_email' } });
    const select = screen.getByRole('combobox', { name: /column to index/i });
    fireEvent.change(select, { target: { value: 'c2' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(onUpdateTable).toHaveBeenCalledWith('t1', {
      indexes: expect.arrayContaining([
        expect.objectContaining({
          id: 'test-index-uuid',
          name: 'idx_email',
          columnId: 'c2',
        }),
      ]),
    });
  });

  it('removes an index when Remove is clicked', () => {
    const onUpdateTable = vi.fn();
    render(
      <TableNode
        table={
          makeTable({
            columns: [makeColumn({ id: 'c1', name: 'id', dataType: 'integer' })],
            indexes: [{ id: 'i1', name: 'idx_id', columnId: 'c1' }],
          })
        }
        uniqueConstraints={[]}
        onUpdatePosition={vi.fn()}
        onUpdateTable={onUpdateTable}
        onAddColumn={vi.fn()}
        onRemoveColumn={vi.fn()}
      onAddUniqueConstraint={vi.fn()}
      onRemoveUniqueConstraint={vi.fn()}
      onUpdateUniqueConstraint={vi.fn()}
        onUpdateColumn={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Remove index idx_id/i }));
    expect(onUpdateTable).toHaveBeenCalledWith('t1', {
      indexes: [],
    });
  });

  it('edits an index when Edit is clicked and Save is submitted', () => {
    const onUpdateTable = vi.fn();
    render(
      <TableNode
        table={
          makeTable({
            columns: [
              makeColumn({ id: 'c1', name: 'id', dataType: 'integer' }),
              makeColumn({ id: 'c2', name: 'email', dataType: 'varchar' }),
            ],
            indexes: [{ id: 'i1', name: 'idx_id', columnId: 'c1' }],
          })
        }
        uniqueConstraints={[]}
        onUpdatePosition={vi.fn()}
        onUpdateTable={onUpdateTable}
        onAddColumn={vi.fn()}
        onRemoveColumn={vi.fn()}
      onAddUniqueConstraint={vi.fn()}
      onRemoveUniqueConstraint={vi.fn()}
      onUpdateUniqueConstraint={vi.fn()}
        onUpdateColumn={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Edit index idx_id/i }));
    const nameInput = screen.getByPlaceholderText('Index name');
    expect(nameInput).toHaveValue('idx_id');
    fireEvent.change(nameInput, { target: { value: 'idx_user_id' } });
    const select = screen.getByRole('combobox', { name: /column to index/i });
    fireEvent.change(select, { target: { value: 'c1' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(onUpdateTable).toHaveBeenCalledWith('t1', {
      indexes: expect.arrayContaining([
        expect.objectContaining({
          id: 'i1',
          name: 'idx_user_id',
          columnId: 'c1',
        }),
      ]),
    });
  });

  it('cancels index editing without calling onUpdateTable', () => {
    const onUpdateTable = vi.fn();
    render(
      <TableNode
        table={
          makeTable({
            columns: [makeColumn({ id: 'c1', name: 'id', dataType: 'integer' })],
            indexes: [{ id: 'i1', name: 'idx_id', columnId: 'c1' }],
          })
        }
        uniqueConstraints={[]}
        onUpdatePosition={vi.fn()}
        onUpdateTable={onUpdateTable}
        onAddColumn={vi.fn()}
        onRemoveColumn={vi.fn()}
      onAddUniqueConstraint={vi.fn()}
      onRemoveUniqueConstraint={vi.fn()}
      onUpdateUniqueConstraint={vi.fn()}
        onUpdateColumn={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Edit index idx_id/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onUpdateTable).not.toHaveBeenCalled();
  });

  /* ---- Unique constraint tests from trunk ---- */

  it('renders no unique constraint badge when there are no constraints', () => {
    const onUpdateTable = vi.fn();
    render(
      <TableNode
        table={makeTable()}
        uniqueConstraints={[]}
        onUpdatePosition={vi.fn()}
        onUpdateTable={onUpdateTable}
        onAddColumn={vi.fn()}
        onRemoveColumn={vi.fn()}
      onAddUniqueConstraint={vi.fn()}
      onRemoveUniqueConstraint={vi.fn()}
      onUpdateUniqueConstraint={vi.fn()}
        onUpdateColumn={vi.fn()}
      />,
    );
    expect(screen.queryByText('UQ')).toBeNull();
  });

  it('renders a unique constraint badge for a single-column constraint', () => {
    const onUpdateTable = vi.fn();
    const uniqueConstraints: UniqueConstraint[] = [
      { id: 'uc1', tableId: 't1', columnIds: ['c2'], name: 'users_email_key' },
    ];
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
        uniqueConstraints={uniqueConstraints}
        onUpdatePosition={vi.fn()}
        onUpdateTable={onUpdateTable}
        onAddColumn={vi.fn()}
        onRemoveColumn={vi.fn()}
      onAddUniqueConstraint={vi.fn()}
      onRemoveUniqueConstraint={vi.fn()}
      onUpdateUniqueConstraint={vi.fn()}
        onUpdateColumn={vi.fn()}
      />,
    );
    expect(screen.getByText('UQ')).toBeInTheDocument();
    expect(screen.getByTitle(/users_email_key/)).toBeInTheDocument();
    expect(screen.getByTitle(/email/)).toBeInTheDocument();
  });

  it('renders a unique constraint badge for a composite column-group constraint', () => {
    const onUpdateTable = vi.fn();
    const uniqueConstraints: UniqueConstraint[] = [
      {
        id: 'uc1',
        tableId: 't1',
        columnIds: ['c2', 'c3'],
        name: 'orders_user_product_key',
      },
    ];
    render(
      <TableNode
        table={
          makeTable({
            columns: [
              makeColumn({ id: 'c1', name: 'id', dataType: 'integer' }),
              makeColumn({ id: 'c2', name: 'user_id', dataType: 'integer' }),
              makeColumn({ id: 'c3', name: 'product_id', dataType: 'integer' }),
            ],
          })
        }
        uniqueConstraints={uniqueConstraints}
        onUpdatePosition={vi.fn()}
        onUpdateTable={onUpdateTable}
        onAddColumn={vi.fn()}
        onRemoveColumn={vi.fn()}
      onAddUniqueConstraint={vi.fn()}
      onRemoveUniqueConstraint={vi.fn()}
      onUpdateUniqueConstraint={vi.fn()}
        onUpdateColumn={vi.fn()}
      />,
    );
    const badges = screen.getAllByText('UQ');
    expect(badges).toHaveLength(1);
    expect(screen.getByTitle(/orders_user_product_key/)).toBeInTheDocument();
    expect(screen.getByTitle(/user_id/)).toBeInTheDocument();
    expect(screen.getByTitle(/product_id/)).toBeInTheDocument();
  });

  it('renders multiple unique constraint badges for multiple constraints', () => {
    const onUpdateTable = vi.fn();
    const uniqueConstraints: UniqueConstraint[] = [
      { id: 'uc1', tableId: 't1', columnIds: ['c2'], name: 'users_email_key' },
      { id: 'uc2', tableId: 't1', columnIds: ['c1', 'c2'], name: 'users_id_email_key' },
    ];
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
        uniqueConstraints={uniqueConstraints}
        onUpdatePosition={vi.fn()}
        onUpdateTable={onUpdateTable}
        onAddColumn={vi.fn()}
        onRemoveColumn={vi.fn()}
        onUpdateColumn={vi.fn()}
        onAddUniqueConstraint={vi.fn()}
        onRemoveUniqueConstraint={vi.fn()}
        onUpdateUniqueConstraint={vi.fn()}
      />,
    );
    expect(screen.getAllByText('UQ')).toHaveLength(2);
  });

  /* ---- Unique constraint management ---- */

  it('renders the unique constraints section and Add unique constraint button', () => {
    const onAddUniqueConstraint = vi.fn();
    render(
      <TableNode
        table={makeTable()}
        uniqueConstraints={[]}
        onUpdatePosition={vi.fn()}
        onUpdateTable={vi.fn()}
        onAddColumn={vi.fn()}
        onRemoveColumn={vi.fn()}
        onUpdateColumn={vi.fn()}
        onAddUniqueConstraint={onAddUniqueConstraint}
        onRemoveUniqueConstraint={vi.fn()}
        onUpdateUniqueConstraint={vi.fn()}
      />,
    );
    expect(screen.getByText('Unique constraints')).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: /add a new unique constraint to this table/i,
      }),
    ).toBeInTheDocument();
  });

  /* ---- TASK-013: column position tracking for relationship lines ---- */

  it('reports column positions via onColumnPositionUpdate', () => {
    const onColumnPositionUpdate = vi.fn();
    const table = makeTable({
      columns: [
        makeColumn({ id: 'c1', name: 'id' }),
        makeColumn({ id: 'c2', name: 'email' }),
      ],
    });
    render(
      <TableNode
        table={table}
        onUpdatePosition={vi.fn()}
        onColumnPositionUpdate={onColumnPositionUpdate}
        onUpdateTable={vi.fn()}
        onAddColumn={vi.fn()}
        onRemoveColumn={vi.fn()}
        onUpdateColumn={vi.fn()}
        onAddUniqueConstraint={vi.fn()}
        onRemoveUniqueConstraint={vi.fn()}
        onUpdateUniqueConstraint={vi.fn()}
      />,
    );
    expect(onColumnPositionUpdate).toHaveBeenCalledWith('t1', expect.any(Map));
    const positions = onColumnPositionUpdate.mock.calls[0][1];
    expect(positions.get('c1')).toBeDefined();
    expect(positions.get('c2')).toBeDefined();
  });

  it('does not call onColumnPositionUpdate when not provided', () => {
    const table = makeTable({
      columns: [makeColumn({ id: 'c1', name: 'id' })],
    });
    const { container } = render(
      <TableNode
        table={table}
        onUpdatePosition={vi.fn()}
        onUpdateTable={vi.fn()}
        onAddColumn={vi.fn()}
        onRemoveColumn={vi.fn()}
        onUpdateColumn={vi.fn()}
        onAddUniqueConstraint={vi.fn()}
        onRemoveUniqueConstraint={vi.fn()}
        onUpdateUniqueConstraint={vi.fn()}
      />,
    );
    expect(container.querySelectorAll('.table-column')).toHaveLength(1);
  });

  it('adds a unique constraint to a single column', () => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: { randomUUID: () => 'test-uc-uuid' },
    });
    const onAddUniqueConstraint = vi.fn();
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
        uniqueConstraints={[]}
        onUpdatePosition={vi.fn()}
        onUpdateTable={vi.fn()}
        onAddColumn={vi.fn()}
        onRemoveColumn={vi.fn()}
        onUpdateColumn={vi.fn()}
        onAddUniqueConstraint={onAddUniqueConstraint}
        onRemoveUniqueConstraint={vi.fn()}
        onUpdateUniqueConstraint={vi.fn()}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: /add a new unique constraint to this table/i,
      }),
    );
    const nameInput = screen.getByPlaceholderText('Constraint name');
    fireEvent.change(nameInput, { target: { value: 'users_email_key' } });
    const checkbox = screen.getByRole('checkbox', {
      name: 'Include email in unique constraint',
    });
    fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(onAddUniqueConstraint).toHaveBeenCalledWith('t1', ['c2'], 'users_email_key');
  });

  it('adds a unique constraint to a group of columns', () => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: { randomUUID: () => 'test-uc-uuid' },
    });
    const onAddUniqueConstraint = vi.fn();
    render(
      <TableNode
        table={
          makeTable({
            columns: [
              makeColumn({ id: 'c1', name: 'id', dataType: 'integer' }),
              makeColumn({ id: 'c2', name: 'user_id', dataType: 'integer' }),
              makeColumn({ id: 'c3', name: 'product_id', dataType: 'integer' }),
            ],
          })
        }
        uniqueConstraints={[]}
        onUpdatePosition={vi.fn()}
        onUpdateTable={vi.fn()}
        onAddColumn={vi.fn()}
        onRemoveColumn={vi.fn()}
        onUpdateColumn={vi.fn()}
        onAddUniqueConstraint={onAddUniqueConstraint}
        onRemoveUniqueConstraint={vi.fn()}
        onUpdateUniqueConstraint={vi.fn()}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: /add a new unique constraint to this table/i,
      }),
    );
    const nameInput = screen.getByPlaceholderText('Constraint name');
    fireEvent.change(nameInput, { target: { value: 'orders_user_product_key' } });
    const checkbox1 = screen.getByRole('checkbox', {
      name: 'Include user_id in unique constraint',
    });
    const checkbox2 = screen.getByRole('checkbox', {
      name: 'Include product_id in unique constraint',
    });
    fireEvent.click(checkbox1);
    fireEvent.click(checkbox2);
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(onAddUniqueConstraint).toHaveBeenCalledWith(
      't1',
      ['c2', 'c3'],
      'orders_user_product_key',
    );
  });

  it('disables Save when no name or no columns are selected', () => {
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
        uniqueConstraints={[]}
        onUpdatePosition={vi.fn()}
        onUpdateTable={vi.fn()}
        onAddColumn={vi.fn()}
        onRemoveColumn={vi.fn()}
        onUpdateColumn={vi.fn()}
        onAddUniqueConstraint={vi.fn()}
        onRemoveUniqueConstraint={vi.fn()}
        onUpdateUniqueConstraint={vi.fn()}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: /add a new unique constraint to this table/i,
      }),
    );
    const saveButton = screen.getByRole('button', { name: /save/i });
    expect(saveButton).toBeDisabled();
  });

  it('removes a unique constraint when Remove is clicked', () => {
    const onRemoveUniqueConstraint = vi.fn();
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
        uniqueConstraints={[
          { id: 'uc1', tableId: 't1', columnIds: ['c2'], name: 'users_email_key' },
        ]}
        onUpdatePosition={vi.fn()}
        onUpdateTable={vi.fn()}
        onAddColumn={vi.fn()}
        onRemoveColumn={vi.fn()}
        onUpdateColumn={vi.fn()}
        onAddUniqueConstraint={vi.fn()}
        onRemoveUniqueConstraint={onRemoveUniqueConstraint}
        onUpdateUniqueConstraint={vi.fn()}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: /Remove unique constraint users_email_key/i,
      }),
    );
    expect(onRemoveUniqueConstraint).toHaveBeenCalledWith('uc1');
  });

  it('edits a unique constraint name and columns when Edit and Save are clicked', () => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: { randomUUID: () => 'test-uc-uuid' },
    });
    const onUpdateUniqueConstraint = vi.fn();
    render(
      <TableNode
        table={
          makeTable({
            columns: [
              makeColumn({ id: 'c1', name: 'id', dataType: 'integer' }),
              makeColumn({ id: 'c2', name: 'email', dataType: 'varchar' }),
              makeColumn({ id: 'c3', name: 'name', dataType: 'text' }),
            ],
          })
        }
        uniqueConstraints={[
          {
            id: 'uc1',
            tableId: 't1',
            columnIds: ['c2'],
            name: 'users_email_key',
          },
        ]}
        onUpdatePosition={vi.fn()}
        onUpdateTable={vi.fn()}
        onAddColumn={vi.fn()}
        onRemoveColumn={vi.fn()}
        onUpdateColumn={vi.fn()}
        onAddUniqueConstraint={vi.fn()}
        onRemoveUniqueConstraint={vi.fn()}
        onUpdateUniqueConstraint={onUpdateUniqueConstraint}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Edit unique constraint/i }));
    const nameInput = screen.getByPlaceholderText('Constraint name');
    expect(nameInput).toHaveValue('users_email_key');
    fireEvent.change(nameInput, { target: { value: 'users_email_name_key' } });
    // Deselect email, select name instead
    const emailCheckbox = screen.getByRole('checkbox', {
      name: 'Include email in unique constraint',
    });
    fireEvent.click(emailCheckbox);
    const nameCheckbox = screen.getByRole('checkbox', {
      name: 'Include name in unique constraint',
    });
    fireEvent.click(nameCheckbox);
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(onUpdateUniqueConstraint).toHaveBeenCalledWith('uc1', {
      name: 'users_email_name_key',
      columnIds: ['c3'],
    });
  });

  it('cancels unique constraint editing without calling onUpdateUniqueConstraint', () => {
    const onUpdateUniqueConstraint = vi.fn();
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
        uniqueConstraints={[
          { id: 'uc1', tableId: 't1', columnIds: ['c2'], name: 'users_email_key' },
        ]}
        onUpdatePosition={vi.fn()}
        onUpdateTable={vi.fn()}
        onAddColumn={vi.fn()}
        onRemoveColumn={vi.fn()}
        onUpdateColumn={vi.fn()}
        onAddUniqueConstraint={vi.fn()}
        onRemoveUniqueConstraint={vi.fn()}
        onUpdateUniqueConstraint={onUpdateUniqueConstraint}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Edit unique constraint/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onUpdateUniqueConstraint).not.toHaveBeenCalled();
  });
});
