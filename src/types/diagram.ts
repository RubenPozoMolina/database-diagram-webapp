export type Column = {
  id: string;
  name: string;
  dataType: string;
  nullable: boolean;
  primaryKey: boolean;
  defaultValue?: string;
};

export type Index = {
  id: string;
  tableId: string;
  name: string;
  columnIds: string[];
};

export type Table = {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  columns: Column[];
  indexes: Index[];
};

export type UniqueConstraint = {
  id: string;
  tableId: string;
  columnIds: string[];
  name?: string;
};

/**
 * Referential action applied by the database when the referenced (target)
 * row is deleted or updated. Matches PostgreSQL's ON DELETE / ON UPDATE
 * options and the diagram serialization schema.
 */
export type ReferentialAction =
  | 'cascade'
  | 'set null'
  | 'set default'
  | 'restrict'
  | 'no action';

export type Relationship = {
  id: string;
  sourceTableId: string;
  sourceColumnId?: string;
  targetTableId: string;
  targetColumnId?: string;
  onDelete?: ReferentialAction;
  onUpdate?: ReferentialAction;
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
    indexes: [],
  };
}

/**
 * Creates an index associated with a table, tracking which column(s) are
 * indexed (supports composite indexes via an array of column IDs).
 *
 * Used by STORY-007 define index: indexes track query performance
 * considerations and are stored per table. The tableId explicitly
 * associates the index with its owning table.
 */
export function createIndex(
  id: string,
  tableId: string,
  name: string,
  columnIds: string[],
): Index {
  return {
    id,
    tableId,
    name,
    columnIds,
  };
}

export function findIndexById(table: Table, indexId: string): Index | undefined {
  return table.indexes.find((index) => index.id === indexId);
}

export function findColumnById(table: Table, columnId: string): Column | undefined {
  return table.columns.find((column) => column.id === columnId);
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
 * column-to-column mapping that defines which column references which, and
 * the referential integrity actions (onDelete / onUpdate) that the database
 * should enforce when the referenced row changes.
 */
export function createRelationship(
  id: string,
  sourceTableId: string,
  sourceColumnId: string | undefined,
  targetTableId: string,
  targetColumnId: string | undefined,
  onDelete: ReferentialAction = 'no action',
  onUpdate: ReferentialAction = 'no action',
): Relationship {
  return {
    id,
    sourceTableId,
    sourceColumnId,
    targetTableId,
    targetColumnId,
    onDelete,
    onUpdate,
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
 * Referential integrity violation detected on a relationship.
 */
export interface ReferentialIntegrityViolation {
  relationshipId: string;
  sourceTableId: string;
  targetTableId: string;
  message: string;
}

/**
 * Validates referential integrity for all relationships in a diagram.
 *
 * Checks that every relationship:
 *   * references an existing source table,
 *   * references an existing target table,
 *   * references an existing source column (when sourceColumnId is set),
 *   * references an existing target column (when targetColumnId is set),
 *   * references a target column that is part of the target table's primary
 *     key (referential integrity requires the referenced column(s) to be
 *     unique).
 *
 * Returns the list of violations so callers can report or repair them.
 *
 * Used by TASK-014 (AC3): "Referential integrity constraints are tracked".
 */
export function validateReferentialIntegrity(
  diagram: Diagram,
): ReferentialIntegrityViolation[] {
  const violations: ReferentialIntegrityViolation[] = [];

  for (const rel of diagram.relationships) {
    const sourceTable = findTableById(diagram, rel.sourceTableId);
    const targetTable = findTableById(diagram, rel.targetTableId);

    if (!sourceTable) {
      violations.push({
        relationshipId: rel.id,
        sourceTableId: rel.sourceTableId,
        targetTableId: rel.targetTableId,
        message: `Relationship ${rel.id} references an unknown source table ${rel.sourceTableId}.`,
      });
      continue;
    }

    if (!targetTable) {
      violations.push({
        relationshipId: rel.id,
        sourceTableId: rel.sourceTableId,
        targetTableId: rel.targetTableId,
        message: `Relationship ${rel.id} references an unknown target table ${rel.targetTableId}.`,
      });
      continue;
    }

    if (rel.sourceColumnId !== undefined) {
      const sourceColumn = findColumnById(sourceTable, rel.sourceColumnId);
      if (!sourceColumn) {
        violations.push({
          relationshipId: rel.id,
          sourceTableId: rel.sourceTableId,
          targetTableId: rel.targetTableId,
          message: `Relationship ${rel.id} references an unknown source column ${rel.sourceColumnId} on table ${sourceTable.name}.`,
        });
      }
    }

    if (rel.targetColumnId !== undefined) {
      const targetColumn = findColumnById(targetTable, rel.targetColumnId);
      if (!targetColumn) {
        violations.push({
          relationshipId: rel.id,
          sourceTableId: rel.sourceTableId,
          targetTableId: rel.targetTableId,
          message: `Relationship ${rel.id} references an unknown target column ${rel.targetColumnId} on table ${targetTable.name}.`,
        });
        continue;
      }
      // Referential integrity: the referenced column must be part of the
      // target table's primary key (a unique key).
      if (!targetColumn.primaryKey) {
        violations.push({
          relationshipId: rel.id,
          sourceTableId: rel.sourceTableId,
          targetTableId: rel.targetTableId,
          message: `Relationship ${rel.id} targets column ${targetColumn.name} on table ${targetTable.name} which is not part of the primary key.`,
        });
      }
    }
  }

  return violations;
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

/**
 * Returns all columns of a table that are designated as the primary key.
 *
 * Used by TASK-011 (AC1): the table model tracks which column is the primary
 * key. Under entity integrity there is at most one, but this function returns
 * all matches so callers can detect and repair violations.
 */
export function findPrimaryKeyColumns(table: Table): Column[] {
  return table.columns.filter((column) => column.primaryKey);
}

/**
 * Returns the single primary key column of a table, or undefined when the
 * table has no primary key or more than one (an entity integrity violation
 * that callers should handle).
 *
 * Used by TASK-011 (AC1): consumers that expect exactly one primary key
 * column (for example DDL generation and foreign key targeting) use this
 * helper.
 */
export function findPrimaryKeyColumn(table: Table): Column | undefined {
  const pks = findPrimaryKeyColumns(table);
  return pks.length === 1 ? pks[0] : undefined;
}

/**
 * Returns true when the table has at least one primary key column.
 *
 * Used by TASK-011 (AC1).
 */
export function hasPrimaryKey(table: Table): boolean {
  return table.columns.some((column) => column.primaryKey);
}

/**
 * Designates a column as the primary key of a table, enforcing entity
 * integrity: only one column can be the primary key per table, so every
 * other column has its primaryKey flag cleared.
 *
 * Returns a new table object (immutable update). When columnId does not
 * match any column of the table, all primary key flags are cleared so no
 * column remains designated.
 *
 * Used by TASK-011 (AC2): "Only one column can be designated as primary key
 * per table".
 */
export function setPrimaryKeyColumn(
  table: Table,
  columnId: string,
): Table {
  return {
    ...table,
    columns: table.columns.map((column) =>
      column.id === columnId
        ? { ...column, primaryKey: true }
        : { ...column, primaryKey: false },
    ),
  };
}

/**
 * Toggles the primary key designation of a column, enforcing entity
 * integrity: when the column becomes the primary key, every other column of
 * the table is cleared; when the column is already the primary key, its
 * designation is removed, leaving the table with no primary key.
 *
 * Returns a new table object (immutable update).
 *
 * Used by TASK-011 (AC2): the UI checkbox toggle calls this so that checking
 * a new PK column automatically unsets the previous one.
 */
export function togglePrimaryKeyColumn(
  table: Table,
  columnId: string,
): Table {
  const currentPk = findPrimaryKeyColumn(table);
  if (currentPk?.id === columnId) {
    // Already the PK: remove the designation.
    return {
      ...table,
      columns: table.columns.map((column) =>
        column.id === columnId ? { ...column, primaryKey: false } : column,
      ),
    };
  }
  return setPrimaryKeyColumn(table, columnId);
}

/**
 * Validates entity integrity for primary keys: a table must have at most one
 * primary key column. Returns the list of primary key columns so callers can
 * report or repair violations.
 *
 * Used by TASK-011: enforces the entity integrity constraint on primary keys.
 */
export function validatePrimaryKeyUniqueness(table: Table): {
  valid: boolean;
  primaryKeyColumns: Column[];
} {
  const primaryKeyColumns = findPrimaryKeyColumns(table);
  return {
    valid: primaryKeyColumns.length <= 1,
    primaryKeyColumns,
  };
}
