/**
 * Test setup for jsdom-based unit tests.
 *
 * Registers jest-dom matchers and mocks the HTMLCanvasElement 2D rendering
 * context so canvas-based components (the trunk's DiagramCanvas, TableNode and
 * RelationshipLine) can be tested headlessly. The mock context records every
 * call so tests can assert that drawing operations were invoked.
 */

import '@testing-library/jest-dom';

import { beforeEach, vi } from 'vitest';

type MockContext = CanvasRenderingContext2D & Record<string, unknown>;

let mockCtx: MockContext;

function createMockContext(): MockContext {
  const ctx: Record<string, unknown> = {};

  const methods = [
    'save', 'restore', 'beginPath', 'closePath', 'moveTo', 'lineTo',
    'stroke', 'fill', 'fillRect', 'strokeRect', 'clearRect', 'fillText',
    'setLineDash', 'quadraticCurveTo', 'arc', 'rect',
    'translate', 'scale', 'setTransform', 'transform',
  ];
  for (const method of methods) {
    (ctx as Record<string, unknown>)[method] = vi.fn();
  }

  const props = [
    'fillStyle', 'strokeStyle', 'lineWidth', 'lineCap', 'shadowColor',
    'shadowBlur', 'shadowOffsetX', 'shadowOffsetY', 'font', 'textAlign',
    'textBaseline',
  ];
  for (const prop of props) {
    (ctx as Record<string, unknown>)[prop] = '';
  }

  (ctx as Record<string, unknown>).measureText = vi.fn().mockImplementation(
    (text: string) => ({
      width: (text || '').length * 6, // approximate character width
    }),
  );
  return ctx as unknown as MockContext;
}

beforeEach(() => {
  mockCtx = createMockContext();

  // Replace getContext on the HTMLCanvasElement prototype so every canvas
  // returns our mock 2D context.
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (contextId: string) => CanvasRenderingContext2D | null;
  };
  proto.getContext = function (contextId: string): CanvasRenderingContext2D | null {
    if (contextId === '2d') return mockCtx;
    return null;
  };
});
