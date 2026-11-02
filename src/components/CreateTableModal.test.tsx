import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CreateTableModal } from './CreateTableModal';

const renderModal = (props = {}) =>
  render(
    <CreateTableModal
      isOpen={true}
      onClose={vi.fn()}
      onCreate={vi.fn()}
      {...props}
    />,
  );

describe('CreateTableModal', () => {
  it('does not render when closed', () => {
    const { container } = render(
      <CreateTableModal isOpen={false} onClose={vi.fn()} onCreate={vi.fn()} />,
    );
    expect(container.querySelector('.modal')).toBeNull();
  });

  it('renders the table name input and columns list when open', () => {
    renderModal();
    expect(screen.getByLabelText('Table name')).toBeInTheDocument();
    expect(screen.getByText('Columns')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /add column/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /create table/i }),
    ).toBeInTheDocument();
  });

  it('adds a column row when Add column is clicked', () => {
    renderModal();
    expect(screen.queryAllByPlaceholderText('Column name')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: /add column/i }));
    expect(screen.queryAllByPlaceholderText('Column name')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: /add column/i }));
    expect(screen.queryAllByPlaceholderText('Column name')).toHaveLength(2);
  });

  it('removes a column row when Remove is clicked', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /add column/i }));
    expect(screen.queryAllByPlaceholderText('Column name')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: /remove/i }));
    expect(screen.queryAllByPlaceholderText('Column name')).toHaveLength(0);
  });

  it('calls onCreate with the name and columns on submit', () => {
    const onCreate = vi.fn();
    render(<CreateTableModal isOpen onClose={vi.fn()} onCreate={onCreate} />);
    const nameInput = screen.getByLabelText('Table name');
    fireEvent.change(nameInput, { target: { value: 'users' } });
    fireEvent.click(screen.getByRole('button', { name: /create table/i }));
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate).toHaveBeenCalledWith({ name: 'users', columns: [] });
  });

  it('includes added columns in the onCreate payload', () => {
    const onCreate = vi.fn();
    render(<CreateTableModal isOpen onClose={vi.fn()} onCreate={onCreate} />);
    fireEvent.click(screen.getByRole('button', { name: /add column/i }));
    const columnName = screen.getAllByPlaceholderText('Column name')[0];
    fireEvent.change(columnName, { target: { value: 'id' } });
    fireEvent.change(screen.getByLabelText('Table name'), {
      target: { value: 'users' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create table/i }));
    expect(onCreate).toHaveBeenCalledWith({
      name: 'users',
      columns: expect.arrayContaining([expect.objectContaining({ name: 'id' })]),
    });
  });

  it('shows an error and does not call onCreate when the name is empty', () => {
    const onCreate = vi.fn();
    const { container } = render(
      <CreateTableModal isOpen onClose={vi.fn()} onCreate={onCreate} />,
    );
    fireEvent.submit(container.querySelector('form')!);
    expect(screen.getByText(/table name is required/i)).toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('enables the Create Table button only when a name is provided', () => {
    render(
      <CreateTableModal isOpen onClose={vi.fn()} onCreate={vi.fn()} />,
    );
    expect(
      screen.getByRole('button', { name: /create table/i }),
    ).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Table name'), {
      target: { value: 'users' },
    });
    expect(
      screen.getByRole('button', { name: /create table/i }),
    ).not.toBeDisabled();
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    render(<CreateTableModal isOpen onClose={onClose} onCreate={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
