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

export type UniqueConstraint = {
  id: string;
  tableId: string;
  columnIds: string[];
  name?: string;
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
  uniqueConstraints: UniqueConstraint[];
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
    uniqueConstraints: [],
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

/**
 * Creates a unique constraint with the given properties.
 *
 * Used by STORY-006 / TASK-017: unique constraints track which columns
 * or column groups have a uniqueness rule applied, and are stored at
 * the diagram level so composite (multi-column) constraints are supported.
 */
export function createUniqueConstraint(
  id: string,
  tableId: string,
  columnIds: string[],
  name?: string,
): UniqueConstraint {
  return {
    id,
    tableId,
    columnIds,
    ...(name ? { name } : {}),
  };
}

/**
 * Creates a foreign key relationship between two tables.
 *
 * Used by STORY-005 / TASK-014: a relationship records the source table
 * (foreign key side) and target table (referenced side), plus the optional
 * column-to-column mapping that defines which column references which.
 */
export function createRelationship(
  id: string,
  sourceTableId: string,
  sourceColumnId: string | undefined,
  targetTableId: string,
  targetColumnId: string | undefined,
): Relationship {
  return {
    id,
    sourceTableId,
    sourceColumnId,
    targetTableId,
    targetColumnId,
  };
}

/**
 * Returns all relationships that involve a given table (as source or target).
 */
export function findRelationshipsByTable(
  diagram: Diagram,
  tableId: string,
): Relationship[] {
  return diagram.relationships.filter(
    (r) => r.sourceTableId === tableId || r.targetTableId === tableId,
  );
}

/**
 * Returns all unique constraints defined on a given table.
 */
export function findUniqueConstraintsByTable(
  diagram: Diagram,
  tableId: string,
): UniqueConstraint[] {
  return diagram.uniqueConstraints.filter((uc) => uc.tableId === tableId);
}
