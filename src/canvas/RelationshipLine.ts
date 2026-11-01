/**
 * RelationshipLine renderer.
 *
 * Responsible for drawing a relationship line (foreign-key connector)
 * between two table nodes on the diagram canvas.
 *
 * The line is drawn from the closest edge point of the source table to
 * the closest edge point of the target table, with an arrowhead at the
 * target end indicating the "many" side of the relationship.
 */

import type { Point, RelationshipLine, TableNode } from '../types';

// Visual constants for relationship lines.
const LINE_STROKE_WIDTH = 2;
const ARROW_SIZE = 8;
const ARROW_ANGLE = Math.PI / 6; // 30 degrees

// Colour palette (WCAG AA compliant contrasts).
const COLOUR = {
  line: '#64748b',
  lineHover: '#0f172a',
  arrow: '#475569',
};

/**
 * Computes the closest point on the edge of a table rectangle to a target point.
 */
function closestEdgePoint(
  table: TableNode,
  target: Point,
): Point {
  const { x, y } = table.position;
  const { width, height } = table.size;

  const cx = x + width / 2;
  const cy = y + height / 2;

  // Determine which edge is closest to the target.
  const dx = target.x - cx;
  const dy = target.y - cy;

  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  // Normalize to find the dominant direction.
  if (absDx / width > absDy / height) {
    // Left or right edge.
    const edgeX = dx > 0 ? x + width : x;
    const edgeY = Math.min(Math.max(target.y, y), y + height);
    return { x: edgeX, y: edgeY };
  } else {
    // Top or bottom edge.
    const edgeY = dy > 0 ? y + height : y;
    const edgeX = Math.min(Math.max(target.x, x), x + width);
    return { x: edgeX, y: edgeY };
  }
}

/**
 * Draws an arrowhead at the end of a line segment.
 */
function drawArrowhead(
  ctx: CanvasRenderingContext2D,
  from: Point,
  to: Point,
): void {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);

  ctx.save();
  ctx.fillStyle = COLOUR.arrow;
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(
    to.x - ARROW_SIZE * Math.cos(angle - ARROW_ANGLE),
    to.y - ARROW_SIZE * Math.sin(angle - ARROW_ANGLE),
  );
  ctx.lineTo(
    to.x - ARROW_SIZE * Math.cos(angle + ARROW_ANGLE),
    to.y - ARROW_SIZE * Math.sin(angle + ARROW_ANGLE),
  );
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * Draws a single relationship line between two tables.
 *
 * Returns true if both tables were found and the line was drawn,
 * false otherwise (caller may choose to drop orphaned relationships).
 */
export function drawRelationship(
  ctx: CanvasRenderingContext2D,
  relationship: RelationshipLine,
  tables: Map<string, TableNode>,
): boolean {
  const source = tables.get(relationship.sourceTableId);
  const target = tables.get(relationship.targetTableId);

  if (!source || !target) {
    return false;
  }

  const sourceEdge = closestEdgePoint(source, {
    x: target.position.x + target.size.width / 2,
    y: target.position.y + target.size.height / 2,
  });
  const targetEdge = closestEdgePoint(target, {
    x: source.position.x + source.size.width / 2,
    y: source.position.y + source.size.height / 2,
  });

  ctx.save();
  ctx.strokeStyle = COLOUR.line;
  ctx.lineWidth = LINE_STROKE_WIDTH;
  ctx.setLineDash([]);
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.moveTo(sourceEdge.x, sourceEdge.y);
  ctx.lineTo(targetEdge.x, targetEdge.y);
  ctx.stroke();

  // Arrowhead at the target end.
  drawArrowhead(ctx, sourceEdge, targetEdge);

  ctx.restore();

  return true;
}

export type { Point, RelationshipLine, TableNode };
