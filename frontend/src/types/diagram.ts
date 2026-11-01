// Frontend types for the Database Diagram Web Application
// These types are shared between components and services

export type ColumnType =
  | "integer"
  | "bigint"
  | "serial"
  | "bigserial"
  | "text"
  | "varchar"
  | "boolean"
  | "date"
  | "timestamp"
  | "numeric"
  | "uuid"
  | "jsonb";

export type Table = {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  columns: Column[];
};

export type Column = {
  id: string;
  name: string;
  type: ColumnType;
  length: number | null;
  nullable: boolean;
  primaryKey: boolean;
  unique: boolean;
  defaultValue: string | null;
  comment: string | null;
};

export type Relationship = {
  id: string;
  sourceTableId: string;
  sourceColumnId: string;
  targetTableId: string;
  targetColumnId: string;
  onDelete: "cascade" | "set null" | "set default" | "restrict" | "no action";
  onUpdate: "cascade" | "set null" | "set default" | "restrict" | "no action";
};

export type UniqueConstraint = {
  id: string;
  tableId: string;
  columnIds: string[];
  name: string | null;
};

export type Index = {
  id: string;
  tableId: string;
  columnIds: string[];
  unique: boolean;
  name: string | null;
};

export type Diagram = {
  id: string;
  name: string;
  tables: Table[];
  relationships: Relationship[];
  uniqueConstraints: UniqueConstraint[];
  indexes: Index[];
  createdAt: string;
  updatedAt: string;
};

export type DiagramJSON = {
  version: string;
  diagram: Diagram;
};
