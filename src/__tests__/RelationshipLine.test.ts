/**
 * Unit tests for the relationship line rendering helpers.
 */

import { describe, it, expect, vi } from 'vitest';
import { drawRelationship } from '../canvas/RelationshipLine';
import type { RelationshipLine, TableNode } from '../types';

function makeTable(id: string, x: number, y: number): TableNode {
  return {
    id,
    name: `table_${id}`,
    position: { x, y },
    size: { width: 200, height: 120 },
    columns: [],
  };
}

function makeContext(): CanvasRenderingContext2D {
  const canvas = document.createElement('canvas');
  canvas.width = 1000;
  canvas.height = 1000;
  return canvas.getContext('2d')!;
}

describe('drawRelationship', () => {
  it('draws a line between two tables (moveTo, lineTo, stroke called)', () => {
    const ctx = makeContext();
    const moveToSpy = vi.spyOn(ctx, 'moveTo');
    const lineToSpy = vi.spyOn(ctx, 'lineTo');
    const strokeSpy = vi.spyOn(ctx, 'stroke');
    const fillSpy = vi.spyOn(ctx, 'fill'); // arrowhead

    const tables = new Map<string, TableNode>([
      ['t1', makeTable('t1', 100, 100)],
      ['t2', makeTable('t2', 500, 100)],
    ]);

    const relationship: RelationshipLine = {
      id: 'r1',
      sourceTableId: 't1',
      targetTableId: 't2',
    };

    const result = drawRelationship(ctx, relationship, tables);

    expect(result).toBe(true);
    expect(moveToSpy).toHaveBeenCalled();
    expect(lineToSpy).toHaveBeenCalled();
    expect(strokeSpy).toHaveBeenCalled();
    expect(fillSpy).toHaveBeenCalled(); // arrowhead at target
  });

  it('returns false when either table is missing', () => {
    const ctx = makeContext();
    const tables = new Map<string, TableNode>([
      ['t1', makeTable('t1', 100, 100)],
    ]);

    const relationship: RelationshipLine = {
      id: 'r1',
      sourceTableId: 't1',
      targetTableId: 'missing',
    };

    const result = drawRelationship(ctx, relationship, tables);
    expect(result).toBe(false);
  });

  it('computes closest edge points on both tables', () => {
    const ctx = makeContext();
    const moveToSpy = vi.spyOn(ctx, 'moveTo');
    const lineToSpy = vi.spyOn(ctx, 'lineTo');

    const tables = new Map<string, TableNode>([
      ['t1', makeTable('t1', 100, 100)],
      ['t2', makeTable('t2', 500, 100)],
    ]);

    const relationship: RelationshipLine = {
      id: 'r1',
      sourceTableId: 't1',
      targetTableId: 't2',
    };

    drawRelationship(ctx, relationship, tables);

    // moveTo should be on the right edge of the source table (t1).
    // (drawArrowhead also calls moveTo, so we check the first call.)
    const moveToCalls = moveToSpy.mock.calls as Array<[number, number]>;
    const [moveX, moveY] = moveToCalls[0]!;
    expect(moveX).toBe(300); // source right edge: 100 + 200
    expect(moveY).toBe(160); // within source vertical range [100, 220]

    // lineTo should be on the left edge of the target table (t2).
    const lineToCalls = lineToSpy.mock.calls as Array<[number, number]>;
    const [lineX, lineY] = lineToCalls[0]!;
    expect(lineX).toBe(500); // target left edge
    expect(lineY).toBe(160); // within target vertical range
  });
});
