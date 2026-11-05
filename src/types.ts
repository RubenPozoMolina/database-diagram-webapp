/**
 * Domain types for the database diagram canvas.
 *
 * These types describe the model that the canvas renders: table nodes
 * (entities with columns) and relationship lines (foreign-key connectors
 * between tables).
 */

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Column {
  name: string;
  type: string;
  isPrimaryKey: boolean;
  isNullable: boolean;
}

export interface TableNode {
  id: string;
  name: string;
  position: Point;
  size: Size;
  columns: Column[];
}

export interface RelationshipLine {
  id: string;
  sourceTableId: string;
  targetTableId: string;
  sourceColumn?: string;
  targetColumn?: string;
}

export interface DiagramState {
  tables: TableNode[];
  relationships: RelationshipLine[];
}

export interface CanvasBounds {
  width: number;
  height: number;
}

/**
 * PostgreSQL connection details entered by the user in the connection form.
 */
export interface ConnectionConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  /** Target PostgreSQL schema for DDL export (defaults to 'public'). */
  schema: string;
}

/**
 * Result of submitting a connection to the backend.
 */
export interface ConnectionResult {
  success: boolean;
  message?: string;
  error?: string;
}
