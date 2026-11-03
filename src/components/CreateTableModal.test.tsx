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

  it('renders the table name input, columns list, and unique constraints section when open', () => {
    renderModal();
    expect(screen.getByLabelText('Table name')).toBeInTheDocument();
    expect(screen.getByText('Columns')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /add column/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('Unique Constraints')).toBeInTheDocument();
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

  it('calls onCreate with the name, columns, and empty unique constraints on submit', () => {
    const onCreate = vi.fn();
    render(<CreateTableModal isOpen onClose={vi.fn()} onCreate={onCreate} />);
    const nameInput = screen.getByLabelText('Table name');
    fireEvent.change(nameInput, { target: { value: 'users' } });
    fireEvent.click(screen.getByRole('button', { name: /create table/i }));
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate).toHaveBeenCalledWith({
      name: 'users',
      columns: [],
      uniqueConstraints: [],
    });
  });

  it('includes added columns and unique constraints in the onCreate payload', () => {
    const onCreate = vi.fn();
    render(<CreateTableModal isOpen onClose={vi.fn()} onCreate={onCreate} />);

    // Add two columns
    fireEvent.click(screen.getByRole('button', { name: /add column/i }));
    fireEvent.click(screen.getByRole('button', { name: /add column/i }));
    const columnNames = screen.getAllByPlaceholderText('Column name');
    fireEvent.change(columnNames[0], { target: { value: 'id' } });
    fireEvent.change(columnNames[1], { target: { value: 'email' } });

    // Add a unique constraint and select the email column
    fireEvent.click(screen.getByRole('button', { name: /add unique constraint/i }));
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]); // email column checkbox

    fireEvent.change(screen.getByLabelText('Table name'), {
      target: { value: 'users' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create table/i }));

    expect(onCreate).toHaveBeenCalledWith({
      name: 'users',
      columns: expect.arrayContaining([
        expect.objectContaining({ name: 'id' }),
        expect.objectContaining({ name: 'email' }),
      ]),
      uniqueConstraints: expect.arrayContaining([
        expect.objectContaining({ columnIds: expect.arrayContaining([expect.any(String)]) }),
      ]),
    });
  });

  it('toggles primary key on a column via the PK checkbox', () => {
    const onCreate = vi.fn();
    render(<CreateTableModal isOpen onClose={vi.fn()} onCreate={onCreate} />);
    fireEvent.click(screen.getByRole('button', { name: /add column/i }));
    const columnName = screen.getAllByPlaceholderText('Column name')[0];
    fireEvent.change(columnName, { target: { value: 'id' } });

    const pkCheckbox = screen.getByRole('checkbox', {
      name: 'Primary key for id',
    });
    fireEvent.click(pkCheckbox);

    fireEvent.change(screen.getByLabelText('Table name'), {
      target: { value: 'users' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create table/i }));
    expect(onCreate).toHaveBeenCalledWith({
      name: 'users',
      columns: expect.arrayContaining([
        expect.objectContaining({ name: 'id', primaryKey: true }),
      ]),
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

  it('toggles a column in and out of a unique constraint via checkbox', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /add column/i }));
    const columnName = screen.getAllByPlaceholderText('Column name')[0];
    fireEvent.change(columnName, { target: { value: 'email' } });

    fireEvent.click(screen.getByRole('button', { name: /add unique constraint/i }));
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(1);

    // Select the column
    fireEvent.click(checkboxes[0]);
    expect(checkboxes[0]).toBeChecked();

    // Deselect the column
    fireEvent.click(checkboxes[0]);
    expect(checkboxes[0]).not.toBeChecked();
  });

  it('removes a unique constraint when its Remove button is clicked', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /add column/i }));
    fireEvent.click(screen.getByRole('button', { name: /add unique constraint/i }));
    fireEvent.click(screen.getByRole('button', { name: /add unique constraint/i }));
    expect(
      screen.getAllByRole('button', { name: /remove unique constraint/i }),
    ).toHaveLength(2);
    fireEvent.click(screen.getAllByRole('button', { name: /remove unique constraint/i })[0]);
    expect(
      screen.getAllByRole('button', { name: /remove unique constraint/i }),
    ).toHaveLength(1);
  });

  it('hides the Add unique constraint button when no columns exist', () => {
    renderModal();
    expect(
      screen.queryByRole('button', { name: /add unique constraint/i }),
    ).toBeNull();
  });

  it('shows the Add unique constraint button when columns exist', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /add column/i }));
    expect(
      screen.getByRole('button', { name: /add unique constraint/i }),
    ).toBeInTheDocument();
  });
});
