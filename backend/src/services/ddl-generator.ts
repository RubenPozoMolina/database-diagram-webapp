/**
 * DDL (Data Definition Language) generation for PostgreSQL.
 *
 * Converts a diagram model into a deterministic SQL script containing:
 *   * CREATE TABLE statements (columns, nullability, defaults, inline
 *     primary-key / unique constraints for single-column keys)
 *   * PRIMARY KEY constraints (composite keys via ALTER TABLE)
 *   * FOREIGN KEY constraints (from relationships, with ON DELETE / ON UPDATE)
 *   * UNIQUE constraints (single and composite)
 *   * CREATE INDEX statements (single and composite, unique or regular)
 *
 * Design rules (see the Database Expert agent guidelines):
 *   * Tables are created first; every constraint is added afterwards with
 *     ALTER TABLE ... ADD CONSTRAINT, so circular and self-referencing
 *     foreign keys never break creation order.
 *   * All identifiers are quoted with double quotes; reserved words (e.g. a
 *     table named "order") and case-sensitive names are handled safely.
 *   * Identifiers are never concatenated raw into SQL; they are quoted via
 *     quoteIdentifier().
 *   * The script contains no DROP / TRUNCATE / DELETE statements: it only
 *     creates objects, matching the apply-schema route's safety guard.
 *   * Column types are mapped from the diagram ColumnType to PostgreSQL;
 *     unsupported types throw at generation time rather than emitting
 *     invalid SQL.
 */

// ---------------------------------------------------------------------------
// Diagram model (subset required for DDL generation)
// ---------------------------------------------------------------------------

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

export type Column = {
  id: string;
  name: string;
  type: ColumnType;
  length: number | null;
  nullable: boolean;
  primaryKey: boolean;
  unique: boolean;
  defaultValue: string | null;
};

export type Table = {
  id: string;
  name: string;
  columns: Column[];
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

const SERIAL_TYPES = new Set(["serial", "bigserial"]);

function findTableById(diagram: Diagram, tableId: string): Table | undefined {
  return diagram.tables.find((t) => t.id === tableId);
}

function findColumnById(table: Table, columnId: string): Column | undefined {
  return table.columns.find((c) => c.id === columnId);
}

// ---------------------------------------------------------------------------
// Type mapping: diagram ColumnType -> PostgreSQL data type
// ---------------------------------------------------------------------------

/**
 * Maps a diagram column type to its PostgreSQL data type. Throws for types
 * without a supported mapping so invalid SQL is never emitted silently.
 */
function mapColumnType(type: ColumnType, length: number | null): string {
  switch (type) {
    case "integer":
      return "INTEGER";
    case "bigint":
      return "BIGINT";
    case "serial":
      return "SERIAL";
    case "bigserial":
      return "BIGSERIAL";
    case "text":
      return "TEXT";
    case "varchar":
      return length ? `VARCHAR(${length})` : "VARCHAR";
    case "boolean":
      return "BOOLEAN";
    case "date":
      return "DATE";
    case "timestamp":
      return "TIMESTAMP";
    case "numeric":
      return "NUMERIC";
    case "uuid":
      return "UUID";
    case "jsonb":
      return "JSONB";
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
    upper === "TRUE" ||
    upper === "FALSE" ||
    upper === "NULL" ||
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

function buildCreateTable(table: Table): string {
  const pkColumns = table.columns.filter((c) => c.primaryKey);
  const isCompositePK = pkColumns.length > 1;

  const columnDefs = table.columns.map((col) => {
    const parts: string[] = [
      quoteIdentifier(col.name),
      mapColumnType(col.type, col.length)
    ];

    // Primary-key columns are implicitly NOT NULL. SERIAL/BIGSERIAL columns
    // are already NOT NULL by definition, so do not repeat it.
    const isSerial = SERIAL_TYPES.has(col.type);
    if ((!col.nullable || col.primaryKey) && !isSerial) {
      parts.push("NOT NULL");
    }

    const def = renderDefault(col.defaultValue);
    if (def) {
      parts.push(`DEFAULT ${def}`);
    }

    // Inline PRIMARY KEY only for single-column keys; composite keys get a
    // separate table-level constraint below.
    if (col.primaryKey && !isCompositePK) {
      parts.push("PRIMARY KEY");
    }

    if (col.unique) {
      parts.push("UNIQUE");
    }

    return parts.join(" ");
  });

  const columnsSql = columnDefs.join(",\n  ");
  return `CREATE TABLE ${quoteIdentifier(table.name)} (\n  ${columnsSql}\n)`;
}

function buildCompositePrimaryKey(table: Table): string[] {
  const statements: string[] = [];
  const pkColumns = table.columns.filter((c) => c.primaryKey);
  if (pkColumns.length > 1) {
    const columnsSql = pkColumns.map((c) => quoteIdentifier(c.name)).join(", ");
    statements.push(
      `ALTER TABLE ${quoteIdentifier(table.name)} ADD CONSTRAINT ${quoteIdentifier(
        `pk_${table.name}`
      )} PRIMARY KEY (${columnsSql})`
    );
  }
  return statements;
}

function buildForeignKey(diagram: Diagram, rel: Relationship): string {
  const sourceTable = findTableById(diagram, rel.sourceTableId);
  const targetTable = findTableById(diagram, rel.targetTableId);
  if (!sourceTable || !targetTable) {
    throw new Error(
      `Relationship ${rel.id} references an unknown table (${rel.sourceTableId} -> ${rel.targetTableId}).`
    );
  }
  const sourceColumn = findColumnById(sourceTable, rel.sourceColumnId);
  const targetColumn = findColumnById(targetTable, rel.targetColumnId);
  if (!sourceColumn || !targetColumn) {
    throw new Error(
      `Relationship ${rel.id} references an unknown column (${rel.sourceColumnId} -> ${rel.targetColumnId}).`
    );
  }

  const constraintName = quoteIdentifier(
    `fk_${sourceTable.name}_${sourceColumn.name}`
  );
  return (
    `ALTER TABLE ${quoteIdentifier(sourceTable.name)} ` +
    `ADD CONSTRAINT ${constraintName} ` +
    `FOREIGN KEY (${quoteIdentifier(sourceColumn.name)}) ` +
    `REFERENCES ${quoteIdentifier(targetTable.name)}(${quoteIdentifier(
      targetColumn.name
    )}) ` +
    `ON DELETE ${rel.onDelete.toUpperCase()} ` +
    `ON UPDATE ${rel.onUpdate.toUpperCase()}`
  );
}

function buildUniqueConstraint(diagram: Diagram, uc: UniqueConstraint): string {
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
        `Unique constraint ${uc.id} references an unknown column ${cid}.`
      );
    }
    rawNames.push(col.name);
    columns.push(quoteIdentifier(col.name));
  }
  // Auto-generated names use raw column names (never the quoted form).
  const name = uc.name ?? `uk_${table.name}_${rawNames.join("_")}`;
  return (
    `ALTER TABLE ${quoteIdentifier(table.name)} ` +
    `ADD CONSTRAINT ${quoteIdentifier(name)} UNIQUE (${columns.join(", ")})`
  );
}

function buildIndex(diagram: Diagram, idx: Index): string {
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
  // Auto-generated names use raw column names (never the quoted form).
  const name = idx.name ?? `idx_${table.name}_${rawNames.join("_")}`;
  return (
    `CREATE ${idx.unique ? "UNIQUE " : ""}INDEX ${quoteIdentifier(name)} ` +
    `ON ${quoteIdentifier(table.name)} (${columns.join(", ")})`
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generates a deterministic PostgreSQL DDL script from a diagram model.
 *
 * Statement order:
 *   1. CREATE TABLE (one per table, with inline column constraints)
 *   2. ALTER TABLE ... ADD CONSTRAINT
 *        a. composite primary keys
 *        b. foreign keys (deferred so circular/self-referencing FKs work)
 *        c. unique constraints
 *   3. CREATE INDEX (one per index)
 *
 * Returns the statements joined by semicolons. Throws if the diagram
 * references unknown tables or columns, or uses an unsupported column type.
 */
export function generateDDL(diagram: Diagram): string {
  const statements: string[] = [];

  // Phase 1: CREATE TABLE.
  for (const table of diagram.tables) {
    statements.push(buildCreateTable(table));
  }

  // Phase 2: constraints (deferred so all tables exist first).
  for (const table of diagram.tables) {
    statements.push(...buildCompositePrimaryKey(table));
  }
  for (const rel of diagram.relationships) {
    statements.push(buildForeignKey(diagram, rel));
  }
  for (const uc of diagram.uniqueConstraints) {
    statements.push(buildUniqueConstraint(diagram, uc));
  }

  // Phase 3: indexes.
  for (const idx of diagram.indexes) {
    statements.push(buildIndex(diagram, idx));
  }

  return statements.length
    ? statements.join(";\n") + ";"
    : "";
}
