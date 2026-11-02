import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { App } from '../App';

describe('App', () => {
  it('displays the New Diagram button', () => {
    render(<App />);
    expect(
      screen.getByRole('button', { name: /Create a new empty diagram/i }),
    ).toBeInTheDocument();
  });

  it('displays an Add Table button', () => {
    render(<App />);
    expect(
      screen.getByRole('button', { name: /Add a new table to the canvas/i }),
    ).toBeInTheDocument();
  });

  it('shows an empty canvas on load', () => {
    render(<App />);
    expect(screen.getByText(/Empty diagram canvas/i)).toBeInTheDocument();
  });

  it('clears and resets canvas when New Diagram is clicked', () => {
    render(<App />);
    const newDiagramButton = screen.getByRole('button', {
      name: /Create a new empty diagram/i,
    });
    fireEvent.click(newDiagramButton);
    expect(screen.getByText(/Empty diagram canvas/i)).toBeInTheDocument();
  });

  it('opens the Add Table modal when Add Table is clicked', () => {
    render(<App />);
    fireEvent.click(
      screen.getByRole('button', { name: /Add a new table to the canvas/i }),
    );
    expect(screen.getByLabelText('Table name')).toBeInTheDocument();
    expect(screen.getByText('Columns')).toBeInTheDocument();
  });

  it('adds a table to the canvas when the Add Table form is submitted', () => {
    const globalCrypto = globalThis as {
      crypto?: { randomUUID?: () => string };
    };
    if (!globalCrypto.crypto?.randomUUID) {
      globalCrypto.crypto = { randomUUID: () => 'test-table-uuid' };
    }
    render(<App />);
    fireEvent.click(
      screen.getByRole('button', { name: /Add a new table to the canvas/i }),
    );
    const nameInput = screen.getByLabelText('Table name');
    fireEvent.change(nameInput, { target: { value: 'users' } });
    fireEvent.click(screen.getByRole('button', { name: /create table/i }));
    expect(screen.queryByText(/Empty diagram canvas/i)).not.toBeInTheDocument();
    expect(screen.getByText('users')).toBeInTheDocument();
  });

  it('adds columns to the created table on the canvas', () => {
    const globalCrypto = globalThis as {
      crypto?: { randomUUID?: () => string };
    };
    if (!globalCrypto.crypto?.randomUUID) {
      globalCrypto.crypto = { randomUUID: () => 'test-table-uuid' };
    }
    render(<App />);
    fireEvent.click(
      screen.getByRole('button', { name: /Add a new table to the canvas/i }),
    );
    fireEvent.change(screen.getByLabelText('Table name'), {
      target: { value: 'orders' },
    });
    fireEvent.click(screen.getByRole('button', { name: /add column/i }));
    fireEvent.change(screen.getAllByPlaceholderText('Column name')[0], {
      target: { value: 'order_id' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create table/i }));
    expect(screen.getByText('orders')).toBeInTheDocument();
    expect(screen.getByText(/order_id: text/)).toBeInTheDocument();
  });
});
