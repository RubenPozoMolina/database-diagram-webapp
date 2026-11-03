export type Column = {
  id: string;
  name: string;
  dataType: string;
  nullable: boolean;
  primaryKey: boolean;
  defaultValue?: string;
};

export type Table = {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  columns: Column[];
};

export type Relationship = {
  id: string;
  sourceTableId: string;
  sourceColumnId?: string;
  targetTableId: string;
  targetColumnId?: string;
};

export type Diagram = {
  id: string;
  name: string;
  tables: Table[];
  relationships: Relationship[];
};

export type DiagramBounds = {
  width: number;
  height: number;
};

export const DEFAULT_DIAGRAM_BOUNDS: DiagramBounds = {
  width: 1200,
  height: 800,
};

export function createEmptyDiagram(name = 'New Diagram'): Diagram {
  return {
    id: crypto.randomUUID(),
    name,
    tables: [],
    relationships: [],
  };
}

/**
 * Creates a column with the given properties.
 *
 * Used by TASK-005 table data model: columns store name, data type,
 * nullable flag and optional default value.
 */
export function createColumn(
  id: string,
  name: string,
  dataType: string,
  nullable: boolean,
  defaultValue?: string,
  primaryKey = false,
): Column {
  return {
    id,
    name,
    dataType,
    nullable,
    defaultValue,
    primaryKey,
  };
}

/**
 * Creates a table with the given properties.
 *
 * Used by TASK-005 table data model: tables store a name and a list
 * of columns, plus canvas position and size.
 */
export function createTable(
  id: string,
  name: string,
  x: number,
  y: number,
  width: number,
  height: number,
  columns: Column[] = [],
): Table {
  return {
    id,
    name,
    x,
    y,
    width,
    height,
    columns,
  };
}

export function findTableById(diagram: Diagram, tableId: string): Table | undefined {
  return diagram.tables.find((table) => table.id === tableId);
}

export function findRelationshipById(
  diagram: Diagram,
  relationshipId: string,
): Relationship | undefined {
  return diagram.relationships.find((rel) => rel.id === relationshipId);
}
