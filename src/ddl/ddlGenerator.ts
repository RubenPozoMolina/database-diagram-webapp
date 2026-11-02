/**
 * DDL (Data Definition Language) generation for PostgreSQL on the frontend.
 *
 * Converts an in-memory {@link Diagram} model into a deterministic SQL script
 * containing CREATE TABLE statements, primary key, foreign key, unique
 * constraint and index definitions.
 *
 * This module mirrors the backend DDL generator (TASK-043) so the frontend can
 * display generated DDL to the user before they confirm execution.
 *
 * Design rules:
 *   * Tables are created first; every constraint is added afterwards with
 *     ALTER TABLE ... ADD CONSTRAINT, so circular and self-referencing
 *     foreign keys never break creation order.
 *   * All identifiers are quoted with double quotes.
 *   * The script contains no DROP / TRUNCATE / DELETE statements.
 *   * Unsupported column types throw at generation time.
 */

import type { Column, Diagram, Relationship } from '../types/diagram';

// ---------------------------------------------------------------------------
// Types used internally by the generator
// ---------------------------------------------------------------------------

export type DdlColumn = {
  id: string;
  name: string;
  dataType: string;
  length: number | null;
  nullable: boolean;
  primaryKey: boolean;
  unique: boolean;
  defaultValue: string | null;
};

export type DdlTable = {
  id: string;
  name: string;
  columns: DdlColumn[];
};

export type DdlRelationship = {
  id: string;
  sourceTableId: string;
  sourceColumnId: string;
  targetTableId: string;
  targetColumnId: string;
};

export type DdlUniqueConstraint = {
  id: string;
  tableId: string;
  columnIds: string[];
  name: string | null;
};

export type DdlIndex = {
  id: string;
  tableId: string;
  columnIds: string[];
  unique: boolean;
  name: string | null;
};

export type DdlDiagram = {
  id: string;
  name: string;
  tables: DdlTable[];
  relationships: DdlRelationship[];
  uniqueConstraints: DdlUniqueConstraint[];
  indexes: DdlIndex[];
};

// ---------------------------------------------------------------------------
// Identifier quoting
// ---------------------------------------------------------------------------

/**
 * Quotes a PostgreSQL identifier with double quotes. Embedded double quotes
 * are escaped by doubling them. Never concatenates raw input into SQL.
 */
function quoteIdentifier(name: string): string {
  return `"` + name.replace(/"/g, '""') + `"`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SERIAL_TYPES = new Set(['serial', 'bigserial']);

function findTableById(diagram: DdlDiagram, tableId: string): DdlTable | undefined {
  return diagram.tables.find((t) => t.id === tableId);
}

function findColumnById(table: DdlTable, columnId: string): DdlColumn | undefined {
  return table.columns.find((c) => c.id === columnId);
}

// ---------------------------------------------------------------------------
// Type mapping: diagram column type -> PostgreSQL data type
// ---------------------------------------------------------------------------

/**
 * Maps a diagram column type to its PostgreSQL data type. Throws for types
 * without a supported mapping so invalid SQL is never emitted silently.
 */
function mapColumnType(type: string, length: number | null): string {
  const upper = type.toUpperCase();
  switch (upper) {
    case 'INTEGER':
      return 'INTEGER';
    case 'BIGINT':
      return 'BIGINT';
    case 'SERIAL':
      return 'SERIAL';
    case 'BIGSERIAL':
      return 'BIGSERIAL';
    case 'TEXT':
      return 'TEXT';
    case 'VARCHAR':
      return length ? `VARCHAR(${length})` : 'VARCHAR';
    case 'BOOLEAN':
      return 'BOOLEAN';
    case 'DATE':
      return 'DATE';
    case 'TIMESTAMP':
      return 'TIMESTAMP';
    case 'NUMERIC':
      return 'NUMERIC';
    case 'UUID':
      return 'UUID';
    case 'JSONB':
      return 'JSONB';
    default:
      throw new Error(`Unsupported column type: ${String(type)}`);
  }
}

/**
 * Renders a column default value for SQL. Numeric and boolean literals are
 * emitted as-is; everything else is treated as a string literal with
 * single-quote escaping. Returns null when there is no default.
 */
function renderDefault(defaultValue: string | null): string | null {
  if (defaultValue === null || defaultValue === undefined) {
    return null;
  }
  const trimmed = defaultValue.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const upper = trimmed.toUpperCase();
  if (
    upper === 'TRUE' ||
    upper === 'FALSE' ||
    upper === 'NULL' ||
    upper === 'CURRENT_TIMESTAMP' ||
    upper === 'CURRENT_DATE' ||
    /^-?\d+(\.\d+)?$/.test(trimmed)
  ) {
    return trimmed;
  }
  // String literal: escape single quotes by doubling them.
  return "'" + trimmed.replace(/'/g, "''") + "'";
}

// ---------------------------------------------------------------------------
// Statement builders
// ---------------------------------------------------------------------------

function buildCreateTable(table: DdlTable): string {
  const pkColumns = table.columns.filter((c) => c.primaryKey);
  const isCompositePK = pkColumns.length > 1;

  const columnDefs = table.columns.map((col) => {
    const parts: string[] = [
      quoteIdentifier(col.name),
      mapColumnType(col.dataType, col.length),
    ];

    const isSerial = SERIAL_TYPES.has(col.dataType.toLowerCase());
    if ((!col.nullable || col.primaryKey) && !isSerial) {
      parts.push('NOT NULL');
    }

    const def = renderDefault(col.defaultValue);
    if (def) {
      parts.push(`DEFAULT ${def}`);
    }

    if (col.primaryKey && !isCompositePK) {
      parts.push('PRIMARY KEY');
    }

    if (col.unique) {
      parts.push('UNIQUE');
    }

    return parts.join(' ');
  });

  const columnsSql = columnDefs.join(',\n  ');
  return `CREATE TABLE ${quoteIdentifier(table.name)} (\n  ${columnsSql}\n)`;
}

function buildCompositePrimaryKey(table: DdlTable): string[] {
  const statements: string[] = [];
  const pkColumns = table.columns.filter((c) => c.primaryKey);
  if (pkColumns.length > 1) {
    const columnsSql = pkColumns.map((c) => quoteIdentifier(c.name)).join(', ');
    statements.push(
      `ALTER TABLE ${quoteIdentifier(table.name)} ADD CONSTRAINT ${quoteIdentifier(
        `pk_${table.name}`,
      )} PRIMARY KEY (${columnsSql})`,
    );
  }
  return statements;
}

function buildForeignKey(
  diagram: DdlDiagram,
  rel: DdlRelationship,
): string {
  const sourceTable = findTableById(diagram, rel.sourceTableId);
  const targetTable = findTableById(diagram, rel.targetTableId);
  if (!sourceTable || !targetTable) {
    throw new Error(
      `Relationship ${rel.id} references an unknown table (${rel.sourceTableId} -> ${rel.targetTableId}).`,
    );
  }
  const sourceColumn = findColumnById(sourceTable, rel.sourceColumnId);
  const targetColumn = findColumnById(targetTable, rel.targetColumnId);
  if (!sourceColumn || !targetColumn) {
    throw new Error(
      `Relationship ${rel.id} references an unknown column (${rel.sourceColumnId} -> ${rel.targetColumnId}).`,
    );
  }

  const constraintName = quoteIdentifier(
    `fk_${sourceTable.name}_${sourceColumn.name}`,
  );
  return (
    `ALTER TABLE ${quoteIdentifier(sourceTable.name)} ` +
    `ADD CONSTRAINT ${constraintName} ` +
    `FOREIGN KEY (${quoteIdentifier(sourceColumn.name)}) ` +
    `REFERENCES ${quoteIdentifier(targetTable.name)}(${quoteIdentifier(
      targetColumn.name,
    )}) ` +
    `ON DELETE NO ACTION ON UPDATE NO ACTION`
  );
}

function buildUniqueConstraint(
  diagram: DdlDiagram,
  uc: DdlUniqueConstraint,
): string {
  const table = findTableById(diagram, uc.tableId);
  if (!table) {
    throw new Error(`Unique constraint ${uc.id} references an unknown table.`);
  }
  const rawNames: string[] = [];
  const columns: string[] = [];
  for (const cid of uc.columnIds) {
    const col = findColumnById(table, cid);
    if (!col) {
      throw new Error(
        `Unique constraint ${uc.id} references an unknown column ${cid}.`,
      );
    }
    rawNames.push(col.name);
    columns.push(quoteIdentifier(col.name));
  }
  const name = uc.name ?? `uk_${table.name}_${rawNames.join('_')}`;
  return (
    `ALTER TABLE ${quoteIdentifier(table.name)} ` +
    `ADD CONSTRAINT ${quoteIdentifier(name)} UNIQUE (${columns.join(', ')})`
  );
}

function buildIndex(diagram: DdlDiagram, idx: DdlIndex): string {
  const table = findTableById(diagram, idx.tableId);
  if (!table) {
    throw new Error(`Index ${idx.id} references an unknown table.`);
  }
  const rawNames: string[] = [];
  const columns: string[] = [];
  for (const cid of idx.columnIds) {
    const col = findColumnById(table, cid);
    if (!col) {
      throw new Error(`Index ${idx.id} references an unknown column ${cid}.`);
    }
    rawNames.push(col.name);
    columns.push(quoteIdentifier(col.name));
  }
  const name = idx.name ?? `idx_${table.name}_${rawNames.join('_')}`;
  return (
    `CREATE ${idx.unique ? 'UNIQUE ' : ''}INDEX ${quoteIdentifier(name)} ` +
    `ON ${quoteIdentifier(table.name)} (${columns.join(', ')})`
  );
}

// ---------------------------------------------------------------------------
// Conversion from frontend Diagram to internal DDL diagram
// ---------------------------------------------------------------------------

/**
 * Converts the frontend Diagram type into the internal DDL diagram type used
 * by the statement builders.
 */
function convertDiagram(diagram: Diagram): DdlDiagram {
  return {
    id: diagram.id,
    name: diagram.name,
    tables: diagram.tables.map((table) => ({
      id: table.id,
      name: table.name,
      columns: table.columns.map((col) => ({
        id: col.id,
        name: col.name,
        dataType: col.dataType,
        length: null,
        nullable: col.nullable,
        primaryKey: col.primaryKey,
        unique: false,
        defaultValue: col.defaultValue ?? null,
      })),
    })),
    relationships: diagram.relationships.map((rel) => ({
      id: rel.id,
      sourceTableId: rel.sourceTableId,
      sourceColumnId: rel.sourceColumnId ?? '',
      targetTableId: rel.targetTableId,
      targetColumnId: rel.targetColumnId ?? '',
    })),
    uniqueConstraints: [],
    indexes: [],
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generates a deterministic PostgreSQL DDL script from a frontend Diagram.
 *
 * Statement order:
 *   1. CREATE TABLE (one per table, with inline column constraints)
 *   2. ALTER TABLE ... ADD CONSTRAINT
 *        a. composite primary keys
 *        b. foreign keys (deferred so circular/self-referencing FKs work)
 *   3. CREATE INDEX
 *
 * Returns the statements joined by semicolons. Throws if the diagram
 * references unknown tables or columns, or uses an unsupported column type.
 */
export function generateDDL(diagram: Diagram): string {
  const ddlDiagram = convertDiagram(diagram);
  const statements: string[] = [];

  // Phase 1: CREATE TABLE.
  for (const table of ddlDiagram.tables) {
    statements.push(buildCreateTable(table));
  }

  // Phase 2: constraints (deferred so all tables exist first).
  for (const table of ddlDiagram.tables) {
    statements.push(...buildCompositePrimaryKey(table));
  }
  for (const rel of ddlDiagram.relationships) {
    statements.push(buildForeignKey(ddlDiagram, rel));
  }
  for (const uc of ddlDiagram.uniqueConstraints) {
    statements.push(buildUniqueConstraint(ddlDiagram, uc));
  }

  // Phase 3: indexes.
  for (const idx of ddlDiagram.indexes) {
    statements.push(buildIndex(ddlDiagram, idx));
  }

  return statements.length
    ? statements.join(';\n') + ';'
    : '';
}
