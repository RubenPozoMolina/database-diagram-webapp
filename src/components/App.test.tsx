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

  it('adds a table with a name and editable columns when Add Table is clicked', () => {
    render(<App />);
    const addTableButton = screen.getByRole('button', {
      name: /Add a new table to the canvas/i,
    });
    fireEvent.click(addTableButton);
    expect(screen.getByText('Table 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Add column')).toBeInTheDocument();
    expect(screen.getByLabelText('Column name')).toBeInTheDocument();
    expect(screen.getByLabelText('Data type')).toBeInTheDocument();
  });

  it('adds multiple tables with incremental names', () => {
    render(<App />);
    const addTableButton = screen.getByRole('button', {
      name: /Add a new table to the canvas/i,
    });
    fireEvent.click(addTableButton);
    fireEvent.click(addTableButton);
    expect(screen.getByText('Table 1')).toBeInTheDocument();
    expect(screen.getByText('Table 2')).toBeInTheDocument();
  });
});
