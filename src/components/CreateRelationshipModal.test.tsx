import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CreateRelationshipModal } from './CreateRelationshipModal';
import type { Column, Table } from '../types/diagram';

const makeTable = (id: string, name: string, columns: Column[] = []): Table => ({
  id,
  name,
  x: 0,
  y: 0,
  width: 220,
  height: 120,
  columns,
});

const renderModal = (props = {}) =>
  render(
    <CreateRelationshipModal
      isOpen={true}
      onClose={vi.fn()}
      tables={[]}
      onCreate={vi.fn()}
      {...props}
    />,
  );

describe('CreateRelationshipModal', () => {
  it('does not render when closed', () => {
    const { container } = render(
      <CreateRelationshipModal
        isOpen={false}
        onClose={vi.fn()}
        tables={[]}
        onCreate={vi.fn()}
      />,
    );
    expect(container.querySelector('.modal')).toBeNull();
  });

  it('renders source and target table and column selects when open', () => {
    const tables = [
      makeTable('t1', 'users', [{ id: 'c1', name: 'id', dataType: 'integer', nullable: false, primaryKey: true }]),
      makeTable('t2', 'orders', [{ id: 'c2', name: 'order_id', dataType: 'integer', nullable: false, primaryKey: true }]),
    ];
    render(<CreateRelationshipModal isOpen onClose={vi.fn()} tables={tables} onCreate={vi.fn()} />);
    expect(screen.getByLabelText('Source table')).toBeInTheDocument();
    expect(screen.getByLabelText('Source column')).toBeInTheDocument();
    expect(screen.getByLabelText('Target table')).toBeInTheDocument();
    expect(screen.getByLabelText('Target column')).toBeInTheDocument();
  });

  it('disables the source column select until a source table is chosen', () => {
    const tables = [
      makeTable('t1', 'users', [{ id: 'c1', name: 'id', dataType: 'integer', nullable: false, primaryKey: true }]),
    ];
    render(<CreateRelationshipModal isOpen onClose={vi.fn()} tables={tables} onCreate={vi.fn()} />);
    expect(screen.getByLabelText('Source column')).toBeDisabled();
  });

  it('excludes the source table from the target table options', () => {
    const tables = [
      makeTable('t1', 'users', [{ id: 'c1', name: 'id', dataType: 'integer', nullable: false, primaryKey: true }]),
      makeTable('t2', 'orders', [{ id: 'c2', name: 'order_id', dataType: 'integer', nullable: false, primaryKey: true }]),
    ];
    render(<CreateRelationshipModal isOpen onClose={vi.fn()} tables={tables} onCreate={vi.fn()} />);
    const sourceSelect = screen.getByLabelText('Source table');
    fireEvent.change(sourceSelect, { target: { value: 't1' } });
    const targetSelect = screen.getByLabelText('Target table');
    expect(targetSelect).toHaveAttribute('value', '');
    // users should no longer be an option for the target
    expect(
      screen.getAllByRole('option', { name: 'users' }),
    ).toHaveLength(1); // only in source select
  });

  it('populates source columns when a source table is selected', () => {
    const tables = [
      makeTable('t1', 'users', [
        { id: 'c1', name: 'id', dataType: 'integer', nullable: false, primaryKey: true },
        { id: 'c2', name: 'email', dataType: 'varchar', nullable: false },
      ]),
    ];
    render(<CreateRelationshipModal isOpen onClose={vi.fn()} tables={tables} onCreate={vi.fn()} />);
    const sourceSelect = screen.getByLabelText('Source table');
    fireEvent.change(sourceSelect, { target: { value: 't1' } });
    expect(screen.getByLabelText('Source column')).not.toBeDisabled();
    fireEvent.click(screen.getByRole('option', { name: 'email' }));
  });

  it('shows an error and does not call onCreate when selections are incomplete', () => {
    const onCreate = vi.fn();
    const tables = [
      makeTable('t1', 'users', [{ id: 'c1', name: 'id', dataType: 'integer', nullable: false, primaryKey: true }]),
      makeTable('t2', 'orders', [{ id: 'c2', name: 'order_id', dataType: 'integer', nullable: false, primaryKey: true }]),
    ];
    const { container } = render(
      <CreateRelationshipModal isOpen onClose={vi.fn()} tables={tables} onCreate={onCreate} />,
    );
    fireEvent.submit(container.querySelector('form')!);
    expect(screen.getByText(/please select source and target tables and columns/i)).toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('shows an error when source and target tables are the same', () => {
    const onCreate = vi.fn();
    const tables = [
      makeTable('t1', 'users', [{ id: 'c1', name: 'id', dataType: 'integer', nullable: false, primaryKey: true }]),
      makeTable('t2', 'orders', [{ id: 'c2', name: 'order_id', dataType: 'integer', nullable: false, primaryKey: true }]),
    ];
    render(<CreateRelationshipModal isOpen onClose={vi.fn()} tables={tables} onCreate={onCreate} />);
    const sourceSelect = screen.getByLabelText('Source table');
    fireEvent.change(sourceSelect, { target: { value: 't1' } });
    fireEvent.click(screen.getByRole('option', { name: 'id' }));
    const targetSelect = screen.getByLabelText('Target table');
    fireEvent.click(screen.getByRole('option', { name: 'orders' }));
    fireEvent.click(screen.getByRole('option', { name: 'order_id' }));
    fireEvent.click(screen.getByRole('button', { name: /create relationship/i }));
    expect(screen.getByText(/source and target tables must be different/i)).toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('calls onCreate with source and target tables and columns on submit', () => {
    const onCreate = vi.fn();
    const tables = [
      makeTable('t1', 'users', [{ id: 'c1', name: 'id', dataType: 'integer', nullable: false, primaryKey: true }]),
      makeTable('t2', 'orders', [{ id: 'c2', name: 'order_id', dataType: 'integer', nullable: false, primaryKey: true }]),
    ];
    render(<CreateRelationshipModal isOpen onClose={vi.fn()} tables={tables} onCreate={onCreate} />);
    fireEvent.change(screen.getByLabelText('Source table'), { target: { value: 't1' } });
    fireEvent.click(screen.getByRole('option', { name: 'id' }));
    fireEvent.change(screen.getByLabelText('Target table'), { target: { value: 't2' } });
    fireEvent.click(screen.getByRole('option', { name: 'order_id' }));
    fireEvent.click(screen.getByRole('button', { name: /create relationship/i }));
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate).toHaveBeenCalledWith({
      sourceTableId: 't1',
      sourceColumnId: 'c1',
      targetTableId: 't2',
      targetColumnId: 'c2',
    });
  });

  it('disables the Create Relationship button until selections are complete', () => {
    const tables = [
      makeTable('t1', 'users', [{ id: 'c1', name: 'id', dataType: 'integer', nullable: false, primaryKey: true }]),
      makeTable('t2', 'orders', [{ id: 'c2', name: 'order_id', dataType: 'integer', nullable: false, primaryKey: true }]),
    ];
    render(<CreateRelationshipModal isOpen onClose={vi.fn()} tables={tables} onCreate={vi.fn()} />);
    expect(screen.getByRole('button', { name: /create relationship/i })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Source table'), { target: { value: 't1' } });
    expect(screen.getByRole('button', { name: /create relationship/i })).toBeDisabled();
    fireEvent.click(screen.getByRole('option', { name: 'id' }));
    fireEvent.change(screen.getByLabelText('Target table'), { target: { value: 't2' } });
    expect(screen.getByRole('button', { name: /create relationship/i })).toBeDisabled();
    fireEvent.click(screen.getByRole('option', { name: 'order_id' }));
    expect(screen.getByRole('button', { name: /create relationship/i })).not.toBeDisabled();
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <CreateRelationshipModal isOpen onClose={onClose} tables={[]} onCreate={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
