/**
 * TableNode renderer.
 *
 * Responsible for drawing a single table node on the diagram canvas.
 * A table node is rendered as a rounded rectangle with:
 *  - a header bar containing the table name,
 *  - a body listing each column (name + data type),
 *  - a visual marker on primary-key columns.
 */

import type { Column, Point, Size, TableNode } from '../types';

// Visual constants for table nodes.
const TABLE_MIN_WIDTH = 180;
const TABLE_MIN_HEIGHT = 100;
const TABLE_PADDING = 12;
const COLUMN_ROW_HEIGHT = 22;
const HEADER_HEIGHT = 28;
const CORNER_RADIUS = 8;
const COLUMN_FONT_SIZE = 12;
const HEADER_FONT_SIZE = 14;

// Colour palette (WCAG AA compliant contrasts).
const COLOUR = {
  tableFill: '#ffffff',
  tableStroke: '#334155',
  tableStrokeWidth: 2,
  headerFill: '#475569',
  headerText: '#ffffff',
  bodyText: '#1e293b',
  columnBorder: '#cbd5e1',
  primaryKeyBadge: '#b91c1c',
  primaryKeyBadgeText: '#ffffff',
  shadow: 'rgba(0, 0, 0, 0.12)',
};

/**
 * Computes the required size for a table node based on its name and columns.
 */
export function computeTableSize(
  name: string,
  columns: Column[],
  ctx: CanvasRenderingContext2D,
): Size {
  ctx.save();
  ctx.font = `${HEADER_FONT_SIZE}px system-ui, -apple-system, sans-serif`;
  const headerWidth = ctx.measureText(name).width;

  ctx.font = `${COLUMN_FONT_SIZE}px system-ui, -apple-system, sans-serif`;
  let maxColumnWidth = 0;
  for (const column of columns) {
    const label = `${column.name}: ${column.type}`;
    maxColumnWidth = Math.max(maxColumnWidth, ctx.measureText(label).width);
  }
  ctx.restore();

  const contentWidth = Math.max(headerWidth, maxColumnWidth);
  const width = Math.max(
    TABLE_MIN_WIDTH,
    contentWidth + TABLE_PADDING * 2,
  );
  const height = Math.max(
    TABLE_MIN_HEIGHT,
    HEADER_HEIGHT + columns.length * COLUMN_ROW_HEIGHT + TABLE_PADDING * 2,
  );

  return { width, height };
}

/**
 * Draws a single table node on the canvas.
 */
export function drawTable(
  ctx: CanvasRenderingContext2D,
  table: TableNode,
): void {
  const { x, y } = table.position;
  const { width, height } = table.size;
  const r = CORNER_RADIUS;

  // Drop shadow.
  ctx.save();
  ctx.shadowColor = COLOUR.shadow;
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 4;

  // Table body (rounded rectangle).
  ctx.fillStyle = COLOUR.tableFill;
  ctx.strokeStyle = COLOUR.tableStroke;
  ctx.lineWidth = COLOUR.tableStrokeWidth;
  drawRoundedRect(ctx, x, y, width, height, r);
  ctx.fill();
  ctx.stroke();

  ctx.restore();

  // Header bar.
  ctx.fillStyle = COLOUR.headerFill;
  drawRoundedRect(ctx, x, y, width, HEADER_HEIGHT, r);
  ctx.fill();

  // Header text (table name).
  ctx.fillStyle = COLOUR.headerText;
  ctx.font = `${HEADER_FONT_SIZE}px system-ui, -apple-system, sans-serif, bold`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    table.name,
    x + TABLE_PADDING,
    y + HEADER_HEIGHT / 2,
    width - TABLE_PADDING * 2,
  );

  // Column rows.
  ctx.font = `${COLUMN_FONT_SIZE}px system-ui, -apple-system, sans-serif`;
  ctx.textBaseline = 'middle';
  let rowY = y + HEADER_HEIGHT + TABLE_PADDING / 2 + COLUMN_ROW_HEIGHT / 2;

  for (const column of table.columns) {
    const rowX = x + TABLE_PADDING;
    const label = `${column.name}: ${column.type}`;

    // Column separator line (except for the last row).
    ctx.strokeStyle = COLOUR.columnBorder;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rowX, rowY + COLUMN_ROW_HEIGHT / 2);
    ctx.lineTo(x + width - TABLE_PADDING, rowY + COLUMN_ROW_HEIGHT / 2);
    ctx.stroke();

    // Primary-key badge.
    if (column.isPrimaryKey) {
      const badgeSize = 14;
      const badgeX = rowX;
      const badgeY = rowY - badgeSize / 2;
      ctx.fillStyle = COLOUR.primaryKeyBadge;
      ctx.fillRect(badgeX, badgeY, badgeSize, badgeSize);
      ctx.fillStyle = COLOUR.primaryKeyBadgeText;
      ctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PK', badgeX + badgeSize / 2, badgeY + badgeSize / 2 + 3);
      ctx.textAlign = 'left';
    }

    // Column label text.
    ctx.fillStyle = COLOUR.bodyText;
    ctx.font = `${COLUMN_FONT_SIZE}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = 'left';
    const textX = column.isPrimaryKey ? rowX + 18 : rowX;
    ctx.fillText(label, textX, rowY);

    rowY += COLUMN_ROW_HEIGHT;
  }
}

/**
 * Draws a rounded rectangle path on the current context.
 */
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

export type { Column, Point, Size, TableNode };
