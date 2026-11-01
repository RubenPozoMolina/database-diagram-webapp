/**
 * Unit tests for the table node size computation and rendering helpers.
 */

import { describe, it, expect } from 'vitest';
import { computeTableSize } from '../canvas/TableNode';
import type { Column } from '../types';

function makeContext(): CanvasRenderingContext2D {
  const canvas = document.createElement('canvas');
  canvas.width = 100;
  canvas.height = 100;
  return canvas.getContext('2d')!;
}

describe('computeTableSize', () => {
  it('returns at least the minimum size for an empty table', () => {
    const ctx = makeContext();
    const size = computeTableSize('users', [], ctx);
    expect(size.width).toBeGreaterThanOrEqual(180);
    expect(size.height).toBeGreaterThanOrEqual(100);
  });

  it('grows width with long table names', () => {
    const ctx = makeContext();
    const small = computeTableSize('users', [], ctx);
    const large = computeTableSize('this_is_a_very_long_table_name', [], ctx);
    expect(large.width).toBeGreaterThan(small.width);
  });

  it('grows height with more columns', () => {
    const ctx = makeContext();
    const col: Column = { name: 'col', type: 'text', isPrimaryKey: false, isNullable: true };
    const small = computeTableSize('t', [col], ctx);
    const large = computeTableSize('t', [col, col, col], ctx);
    expect(large.height).toBeGreaterThan(small.height);
  });

  it('accounts for long column names in width', () => {
    const ctx = makeContext();
    const short: Column = { name: 'a', type: 't', isPrimaryKey: false, isNullable: true };
    const long: Column = {
      name: 'this_is_a_very_long_column_name',
      type: 'character_varying',
      isPrimaryKey: false,
      isNullable: true,
    };
    const small = computeTableSize('t', [short], ctx);
    const large = computeTableSize('t', [long], ctx);
    expect(large.width).toBeGreaterThan(small.width);
  });
});
