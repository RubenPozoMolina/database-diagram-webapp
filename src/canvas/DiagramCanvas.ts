/**
 * DiagramCanvas - the main diagram canvas UI component.
 *
 * The canvas displays an empty workspace where table nodes and
 * relationship lines can be added. It owns the diagram state and is
 * responsible for rendering everything onto an HTMLCanvasElement.
 *
 * Acceptance criteria covered by this component:
 *  1. Empty canvas is displayed when the application loads.
 *  2. Canvas supports rendering table nodes.
 *  3. Canvas supports rendering relationship lines between tables.
 */

import type {
  CanvasBounds,
  Column,
  DiagramState,
  Point,
  RelationshipLine,
  Size,
  TableNode,
} from '../types';
import { computeTableSize, drawTable } from './TableNode';
import { drawRelationship } from './RelationshipLine';

// Default canvas size when no explicit size is set.
const DEFAULT_WIDTH = 1200;
const DEFAULT_HEIGHT = 800;

/**
 * Options for adding a table to the canvas.
 */
export interface AddTableOptions {
  id: string;
  name: string;
  position?: Point;
  size?: Size;
  columns?: Column[];
}

/**
 * Options for adding a relationship to the canvas.
 */
export interface AddRelationshipOptions {
  id: string;
  sourceTableId: string;
  targetTableId: string;
  sourceColumn?: string;
  targetColumn?: string;
}

/**
 * The DiagramCanvas component.
 *
 * Usage:
 *   const canvas = new DiagramCanvas(document.getElementById('diagram-canvas') as HTMLCanvasElement);
 *   canvas.addTable({ id: 't1', name: 'users', position: { x: 100, y: 100 }, columns: [...] });
 *   canvas.addRelationship({ id: 'r1', sourceTableId: 't1', targetTableId: 't2' });
 *   canvas.render();
 */
export class DiagramCanvas {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly tables: Map<string, TableNode> = new Map();
  private readonly relationships: Map<string, RelationshipLine> = new Map();
  private bounds: CanvasBounds;

  constructor(canvas: HTMLCanvasElement, bounds?: CanvasBounds) {
    if (!canvas) {
      throw new Error('DiagramCanvas: a canvas element is required');
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('DiagramCanvas: canvas 2D context is not available');
    }

    this.canvas = canvas;
    this.ctx = ctx;
    this.bounds = bounds ?? { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };

    this.setCanvasSize(this.bounds.width, this.bounds.height);
  }

  /**
   * Returns a read-only snapshot of the current diagram state.
   */
  getState(): DiagramState {
    return {
      tables: Array.from(this.tables.values()),
      relationships: Array.from(this.relationships.values()),
    };
  }

  /**
   * Returns the number of tables currently on the canvas.
   */
  get tableCount(): number {
    return this.tables.size;
  }

  /**
   * Returns the number of relationships currently on the canvas.
   */
  get relationshipCount(): number {
    return this.relationships.size;
  }

  /**
   * Returns true if the canvas is empty (no tables, no relationships).
   */
  get isEmpty(): boolean {
    return this.tables.size === 0 && this.relationships.size === 0;
  }

  /**
   * Adds a table node to the canvas. If no position is given the table is
   * placed at (0, 0); if no size is given it is computed from the content.
   */
  addTable(options: AddTableOptions): void {
    const ctx = this.ctx;

    const position = options.position ?? { x: 0, y: 0 };
    const size =
      options.size ??
      computeTableSize(options.name, options.columns ?? [], ctx);

    const table: TableNode = {
      id: options.id,
      name: options.name,
      position,
      size,
      columns: options.columns ?? [],
    };

    this.tables.set(options.id, table);
  }

  /**
   * Removes a table and any relationships that reference it.
   */
  removeTable(id: string): boolean {
    const removed = this.tables.delete(id);
    if (removed) {
      for (const [relId, rel] of this.relationships) {
        if (rel.sourceTableId === id || rel.targetTableId === id) {
          this.relationships.delete(relId);
        }
      }
    }
    return removed;
  }

  /**
   * Adds a relationship line between two tables.
   */
  addRelationship(options: AddRelationshipOptions): void {
    const relationship: RelationshipLine = {
      id: options.id,
      sourceTableId: options.sourceTableId,
      targetTableId: options.targetTableId,
      sourceColumn: options.sourceColumn,
      targetColumn: options.targetColumn,
    };
    this.relationships.set(options.id, relationship);
  }

  /**
   * Removes a relationship by id.
   */
  removeRelationship(id: string): boolean {
    return this.relationships.delete(id);
  }

  /**
   * Clears all tables and relationships from the canvas.
   */
  clear(): void {
    this.tables.clear();
    this.relationships.clear();
  }

  /**
   * Resizes the canvas backing store and CSS display size.
   */
  resize(width: number, height: number): void {
    this.setCanvasSize(width, height);
  }

  /**
   * Renders the full diagram: relationships first (so they sit behind
   * tables), then table nodes. An empty canvas is drawn as a blank
   * workspace when there is nothing to render.
   */
  render(): void {
    const { width, height } = this.bounds;

    // Clear the entire canvas (empty workspace).
    this.ctx.clearRect(0, 0, width, height);

    // Draw relationship lines first so tables appear on top.
    for (const relationship of this.relationships.values()) {
      drawRelationship(this.ctx, relationship, this.tables);
    }

    // Draw table nodes.
    for (const table of this.tables.values()) {
      drawTable(this.ctx, table);
    }
  }

  private setCanvasSize(width: number, height: number): void {
    this.bounds = { width, height };
    this.canvas.width = width;
    this.canvas.height = height;
    // Reset transform after resizing the backing store.
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
}

export type { DiagramState };
