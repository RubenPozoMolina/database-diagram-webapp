/**
 * PostgreSQL schema introspection service.
 *
 * Introspects a single (non-system) schema and returns tables, columns with
 * data types, primary keys, foreign keys, unique constraints and indexes.
 *
 * Design rules (see the Database Expert agent guidelines):
 *   * All queries run inside a `BEGIN READ ONLY` transaction so the
 *     introspection cannot mutate the target database.
 *   * Only `information_schema` and `pg_catalog` are queried; SQL text is
 *     never parsed.
 *   * The schema name is passed as a parameter ($1), never interpolated into
 *     the SQL string.
 *   * Composite keys, self-referencing foreign keys and circular dependencies
 *     are supported via `key_column_usage` with `ordinal_position`.
 *   * A bounded statement timeout is applied so introspection cannot block
 *     indefinitely.
 *   * The database password is never logged, persisted or included in error
 *     responses.
 *
 * The SQL queries are adapted from `database/introspection.sql` (TASK-039)
 * for single-schema introspection: `NOT IN ('pg_catalog', 'information_schema')`
 * is replaced with `= $1` where `$1` is the caller-supplied schema.
 */

import { Client } from "pg";

const DEFAULT_STATEMENT_TIMEOUT_MS = 30_000;

// ---------------------------------------------------------------------------
// Raw query result types
// ---------------------------------------------------------------------------

interface RawColumn {
  table_schema: string;
  table_name: string;
  column_name: string;
  column_position: number;
  is_nullable: string; // "YES" | "NO"
  column_default: string | null;
  data_type: string;
  character_maximum_length: number | null;
  numeric_precision: number | null;
  numeric_scale: number | null;
  datetime_precision: number | null;
  interval_type: string | null;
}

interface RawPrimaryKey {
  table_name: string;
  constraint_name: string;
  column_name: string;
  column_position: number;
}

interface RawForeignKey {
  table_name: string;
  constraint_name: string;
  column_name: string;
  column_position: number;
  foreign_table_name: string;
  foreign_column_name: string;
  update_rule: string;
  delete_rule: string;
}

interface RawUniqueConstraint {
  table_name: string;
  constraint_name: string;
  column_name: string;
  column_position: number;
}

interface RawIndex {
  table_name: string;
  index_name: string;
  column_name: string;
  column_position: number;
  is_unique: boolean;
  is_primary: boolean;
  is_valid: boolean;
  index_type: string;
  index_definition: string;
}

// ---------------------------------------------------------------------------
// SQL queries
//
// All queries use $1 for the schema parameter (node-postgres / pg style).
// System schemas are excluded by filtering on table_schema = $1.
// ---------------------------------------------------------------------------

export const TABLES_AND_COLUMNS_QUERY = `
SELECT
    t.table_schema                                    AS table_schema,
    t.table_name                                      AS table_name,
    c.column_name                                     AS column_name,
    c.ordinal_position                                AS column_position,
    c.is_nullable                                     AS is_nullable,
    c.column_default                                  AS column_default,
    c.data_type                                       AS data_type,
    c.character_maximum_length                        AS character_maximum_length,
    c.numeric_precision                               AS numeric_precision,
    c.numeric_scale                                   AS numeric_scale,
    c.datetime_precision                              AS datetime_precision,
    c.interval_type                                   AS interval_type
FROM information_schema.tables AS t
JOIN information_schema.columns AS c
  ON c.table_catalog = t.table_catalog
 AND c.table_schema  = t.table_schema
 AND c.table_name    = t.table_name
WHERE t.table_type = 'BASE TABLE'
  AND t.table_schema = $1
ORDER BY t.table_name, c.ordinal_position
`;

export const PRIMARY_KEYS_QUERY = `
SELECT
    tc.table_name                                        AS table_name,
    tc.constraint_name                                   AS constraint_name,
    kcu.column_name                                      AS column_name,
    kcu.ordinal_position                                 AS column_position
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON kcu.constraint_catalog = tc.constraint_catalog
 AND kcu.constraint_schema  = tc.constraint_schema
 AND kcu.constraint_name    = tc.constraint_name
 AND kcu.table_name         = tc.table_name
WHERE tc.constraint_type = 'PRIMARY KEY'
  AND tc.constraint_schema = $1
ORDER BY tc.table_name, tc.constraint_name, kcu.ordinal_position
`;

export const FOREIGN_KEYS_QUERY = `
SELECT
    src.table_name                                       AS table_name,
    rc.constraint_name                                   AS constraint_name,
    src.column_name                                      AS column_name,
    src.ordinal_position                                 AS column_position,
    tgt.table_name                                       AS foreign_table_name,
    tgt.column_name                                      AS foreign_column_name,
    rc.update_rule                                       AS update_rule,
    rc.delete_rule                                       AS delete_rule
FROM information_schema.referential_constraints AS rc
JOIN information_schema.key_column_usage AS src
  ON src.constraint_catalog = rc.constraint_catalog
 AND src.constraint_schema  = rc.constraint_schema
 AND src.constraint_name    = rc.constraint_name
JOIN information_schema.key_column_usage AS tgt
  ON tgt.constraint_catalog = rc.unique_constraint_catalog
 AND tgt.constraint_schema  = rc.unique_constraint_schema
 AND tgt.constraint_name    = rc.unique_constraint_name
 AND tgt.ordinal_position   = src.ordinal_position
WHERE src.constraint_schema = $1
ORDER BY src.table_name, rc.constraint_name, src.ordinal_position
`;

export const UNIQUE_CONSTRAINTS_QUERY = `
SELECT
    tc.table_name                                        AS table_name,
    tc.constraint_name                                   AS constraint_name,
    kcu.column_name                                      AS column_name,
    kcu.ordinal_position                                 AS column_position
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON kcu.constraint_catalog = tc.constraint_catalog
 AND kcu.constraint_schema  = tc.constraint_schema
 AND kcu.constraint_name    = tc.constraint_name
 AND kcu.table_name         = tc.table_name
WHERE tc.constraint_type = 'UNIQUE'
  AND tc.constraint_schema = $1
ORDER BY tc.table_name, tc.constraint_name, kcu.ordinal_position
`;

export const INDEXES_QUERY = `
SELECT
    c.relname                                           AS table_name,
    ic.relname                                          AS index_name,
    a.attname                                           AS column_name,
    g.s + 1                                             AS column_position,
    i.indisunique                                       AS is_unique,
    i.indisprimary                                      AS is_primary,
    i.indisvalid                                        AS is_valid,
    am.amname                                           AS index_type,
    pg_get_indexdef(i.indexrelid)                       AS index_definition
FROM pg_index AS i
JOIN pg_class AS c ON c.oid = i.indrelid
JOIN pg_namespace AS ns ON ns.oid = c.relnamespace
JOIN pg_class AS ic ON ic.oid = i.indexrelid
JOIN pg_am AS am ON am.oid = ic.relam
JOIN generate_subscripts(i.indkey, 1) AS g(s) ON true
JOIN pg_attribute AS a
  ON a.attrelid = i.indrelid
 AND a.attnum = i.indkey[g.s]
WHERE ns.nspname = $1
  AND c.relkind = 'r'
ORDER BY c.relname, ic.relname, g.s
`;

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

/**
 * Error thrown by the introspection service with an associated HTTP status
 * code. The message never contains the database password.
 */
export class IntrospectionError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "IntrospectionError";
    this.statusCode = statusCode;
  }
}

/**
 * Sanitises an error message so it never leaks the password.
 */
function sanitize(message: string): string {
  return message.replace(/\bpassword\b/gi, "[redacted]");
}

/**
 * Maps a PostgreSQL / node-postgres error to an IntrospectionError with the
 * appropriate HTTP status code.
 *
 *   * 401 — authentication failure (SQLSTATE 28P01, 28000 or "authentication
 *     failed" in the message)
 *   * 502 — network / unreachable server (ECONNREFUSED, ENOTFOUND, …)
 *   * 504 — statement or connection timeout (ETIMEDOUT or "timeout" in the
 *     message)
 *   * 500 — everything else
 */
function mapError(err: unknown): IntrospectionError {
  const pgErr = err as { code?: string; message?: string };
  const message = pgErr.message ?? "Unknown error";
  const code = pgErr.code;
  const sanitized = sanitize(message);

  // --- Authentication failures (401) ---
  if (
    code === "28P01" ||
    code === "28000" ||
    /authentication failed/i.test(sanitized)
  ) {
    return new IntrospectionError(
      401,
      `Authentication failed: ${sanitized}`,
    );
  }

  // --- Network / unreachable server (502) ---
  if (
    code === "ECONNREFUSED" ||
    code === "ENOTFOUND" ||
    code === "ENETUNREACH" ||
    code === "ECONNRESET" ||
    /connection refused/i.test(sanitized) ||
    /no such host/i.test(sanitized) ||
    /network is unreachable/i.test(sanitized)
  ) {
    return new IntrospectionError(
      502,
      `Unable to reach PostgreSQL server: ${sanitized}`,
    );
  }

  // --- Statement / connection timeout (504) ---
  if (
    code === "ETIMEDOUT" ||
    /timeout/i.test(sanitized) ||
    /timed out/i.test(sanitized)
  ) {
    return new IntrospectionError(
      504,
      `Schema introspection timed out after ${DEFAULT_STATEMENT_TIMEOUT_MS / 1000} seconds.`,
    );
  }

  // --- Unexpected error (500) ---
  return new IntrospectionError(
    500,
    "Internal server error while introspecting the schema.",
  );
}

// ---------------------------------------------------------------------------
// IntrospectionService
// ---------------------------------------------------------------------------

interface GroupedIntrospection {
  tables: Map<string, {
    columns: RawColumn[];
    primaryKeys: RawPrimaryKey[];
    foreignKeys: RawForeignKey[];
    uniqueConstraints: RawUniqueConstraint[];
    indexes: RawIndex[];
  }>;
  tableOrder: string[];
}

export class IntrospectionService {
  private readonly statementTimeoutMs: number;

  constructor(statementTimeoutMs: number = DEFAULT_STATEMENT_TIMEOUT_MS) {
    this.statementTimeoutMs = statementTimeoutMs;
  }

  /**
   * Introspects the given schema using the supplied (already connected)
   * pg.Client. All queries run inside a single `BEGIN READ ONLY` transaction
   * with a bounded statement timeout.
   *
   * Returns tables with their columns, primary keys, foreign keys, unique
   * constraints and indexes. Throws an IntrospectionError on failure.
   */
  async introspectSchema(
    client: Client,
    schema: string,
  ): Promise<{ tables: Array<{
    name: string;
    columns: RawColumn[];
    primaryKeys: RawPrimaryKey[];
    foreignKeys: RawForeignKey[];
    uniqueConstraints: RawUniqueConstraint[];
    indexes: RawIndex[];
  }> }> {
    try {
      await client.query("BEGIN READ ONLY");
      await client.query(
        `SET statement_timeout = ${this.statementTimeoutMs}`,
      );

      const columnsResult = await client.query<RawColumn>(
        TABLES_AND_COLUMNS_QUERY,
        [schema],
      );
      const pksResult = await client.query<RawPrimaryKey>(
        PRIMARY_KEYS_QUERY,
        [schema],
      );
      const fksResult = await client.query<RawForeignKey>(
        FOREIGN_KEYS_QUERY,
        [schema],
      );
      const uksResult = await client.query<RawUniqueConstraint>(
        UNIQUE_CONSTRAINTS_QUERY,
        [schema],
      );
      const indexesResult = await client.query<RawIndex>(
        INDEXES_QUERY,
        [schema],
      );

      await client.query("COMMIT");

      return {
        tables: this.buildTables(
          columnsResult.rows,
          pksResult.rows,
          fksResult.rows,
          uksResult.rows,
          indexesResult.rows,
        ),
      };
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {
        // Ignore errors during rollback cleanup.
      });
      throw mapError(err);
    }
  }

  /**
   * Groups raw query rows into tables, attaching columns, constraints and
   * indexes to their owning table.
   */
  private buildTables(
    columns: RawColumn[],
    pks: RawPrimaryKey[],
    fks: RawForeignKey[],
    uks: RawUniqueConstraint[],
    indexes: RawIndex[],
  ): Array<{
    name: string;
    columns: RawColumn[];
    primaryKeys: RawPrimaryKey[];
    foreignKeys: RawForeignKey[];
    uniqueConstraints: RawUniqueConstraint[];
    indexes: RawIndex[];
  }> {
    const tableMap = new Map<string, {
      columns: RawColumn[];
      primaryKeys: RawPrimaryKey[];
      foreignKeys: RawForeignKey[];
      uniqueConstraints: RawUniqueConstraint[];
      indexes: RawIndex[];
    }>();
    const tableOrder: string[] = [];

    for (const col of columns) {
      if (!tableMap.has(col.table_name)) {
        tableMap.set(col.table_name, {
          columns: [],
          primaryKeys: [],
          foreignKeys: [],
          uniqueConstraints: [],
          indexes: [],
        });
        tableOrder.push(col.table_name);
      }
      tableMap.get(col.table_name)!.columns.push(col);
    }

    for (const pk of pks) {
      const entry = tableMap.get(pk.table_name);
      if (entry) {
        entry.primaryKeys.push(pk);
      }
    }

    for (const fk of fks) {
      const entry = tableMap.get(fk.table_name);
      if (entry) {
        entry.foreignKeys.push(fk);
      }
    }

    for (const uk of uks) {
      const entry = tableMap.get(uk.table_name);
      if (entry) {
        entry.uniqueConstraints.push(uk);
      }
    }

    for (const idx of indexes) {
      const entry = tableMap.get(idx.table_name);
      if (entry) {
        entry.indexes.push(idx);
      }
    }

    return tableOrder.map((name) => {
      const entry = tableMap.get(name)!;
      return {
        name,
        columns: entry.columns,
        primaryKeys: entry.primaryKeys,
        foreignKeys: entry.foreignKeys,
        uniqueConstraints: entry.uniqueConstraints,
        indexes: entry.indexes,
      };
    });
  }
}
