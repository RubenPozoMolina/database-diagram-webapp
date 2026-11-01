/**
 * Test setup for jsdom-based unit tests.
 *
 * jsdom does not implement HTMLCanvasElement.getContext('2d') without the
 * native `canvas` package. We mock it here so the diagram canvas component
 * can be tested in a headless environment. The mock context records every
 * call so tests can assert that drawing operations were invoked.
 */

import { beforeEach, vi } from 'vitest';

type MockContext = CanvasRenderingContext2D & Record<string, any>;

let mockCtx: MockContext;

function createMockContext(): MockContext {
  const ctx: Record<string, any> = {};

  const methods = [
    'save', 'restore', 'beginPath', 'closePath', 'moveTo', 'lineTo',
    'stroke', 'fill', 'fillRect', 'strokeRect', 'clearRect', 'fillText',
    'setLineDash', 'quadraticCurveTo', 'arc', 'rect',
    'translate', 'scale', 'setTransform', 'transform',
  ];
  for (const method of methods) {
    ctx[method] = vi.fn();
  }

  const props = [
    'fillStyle', 'strokeStyle', 'lineWidth', 'lineCap', 'shadowColor',
    'shadowBlur', 'shadowOffsetX', 'shadowOffsetY', 'font', 'textAlign',
    'textBaseline',
  ];
  for (const prop of props) {
    ctx[prop] = '';
  }

  ctx.measureText = vi.fn().mockImplementation((text: string) => ({
    width: (text || '').length * 6, // approximate character width
  }));
  return ctx as unknown as MockContext;
}

beforeEach(() => {
  mockCtx = createMockContext();

  // Replace getContext on the HTMLCanvasElement prototype so every canvas
  // returns our mock 2D context.
  const proto = HTMLCanvasElement.prototype as any;
  proto.getContext = function (contextId: string) {
    if (contextId === '2d') return mockCtx;
    return null;
  };
});
