import { it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { App } from '../App';

it('renders App', () => {
  render(<App />);
  expect(true).toBe(true);
});
