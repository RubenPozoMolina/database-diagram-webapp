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
});
