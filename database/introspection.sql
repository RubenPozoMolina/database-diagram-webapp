-- ============================================================================
-- PostgreSQL Schema Introspection Queries
-- Compatible with PostgreSQL 14+
-- ============================================================================
--
-- Purpose
-- -------
-- Introspect a PostgreSQL schema and return, in a structured form:
--   1. Tables and columns (with data types)
--   2. Primary keys
--   3. Foreign keys
--   4. Unique constraints
--   5. Indexes
--
-- Usage
-------
-- Run every query inside a read-only transaction:
--     BEGIN READ ONLY;
--     <query>
--     COMMIT;
--
-- Parameter convention
-- --------------------
-- These queries use the `$n` placeholder style (lib/pq, pgx, ...). Adapt the
-- placeholder to your driver before use:
--   - node-postgres (pg)   : $1  (already $n)
--   - psycopg (Python)     : %(schema)s  or  $1
--   - JDBC                 : ?
-- Replace every occurrence of `NOT IN ('pg_catalog', 'information_schema')`
-- with `= $1` when you want to introspect a single, caller-supplied schema.
--
-- Design notes
-- ------------
-- * Only information_schema and pg_catalog are used; SQL text is never parsed.
-- * All queries are read-only (SELECT only). No DDL/DML is generated here.
-- * Quoted identifiers and reserved words are handled by the catalogs.
-- * Composite keys, self-referencing keys and circular dependencies are
--   supported via key_column_usage / constraint_column_usage ordinal_position.
-- * System schemas (pg_catalog, information_schema) are excluded by default.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Tables and columns (includes data types)
-- ----------------------------------------------------------------------------
-- Returns one row per column of every base table in the non-system schemas.
-- Columns: table_catalog, table_schema, table_name, column_name,
--          column_position, is_nullable, column_default, data_type,
--          character_maximum_length, numeric_precision, numeric_scale,
--          datetime_precision, interval_type, udt_name
SELECT
    t.table_catalog                                    AS table_catalog,
    t.table_schema                                     AS table_schema,
    t.table_name                                       AS table_name,
    c.column_name                                      AS column_name,
    c.ordinal_position                                 AS column_position,
    c.is_nullable                                      AS is_nullable,
    c.column_default                                   AS column_default,
    c.data_type                                        AS data_type,
    c.character_maximum_length                         AS character_maximum_length,
    c.numeric_precision                                AS numeric_precision,
    c.numeric_scale                                    AS numeric_scale,
    c.datetime_precision                               AS datetime_precision,
    c.interval_type                                    AS interval_type,
    c.udt_name                                         AS udt_name
FROM information_schema.tables AS t
JOIN information_schema.columns AS c
  ON c.table_catalog = t.table_catalog
 AND c.table_schema  = t.table_schema
 AND c.table_name    = t.table_name
WHERE t.table_type = 'BASE TABLE'
  AND t.table_schema NOT IN ('pg_catalog', 'information_schema')
ORDER BY t.table_schema, t.table_name, c.ordinal_position;

-- ----------------------------------------------------------------------------
-- 2. Primary keys
-- ----------------------------------------------------------------------------
-- Returns one row per column of every PRIMARY KEY constraint.
-- Composite keys produce one row per column, ordered by ordinal_position.
-- Columns: table_schema, table_name, constraint_name, column_name,
--          column_position
SELECT
    tc.constraint_schema                                 AS table_schema,
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
  AND tc.constraint_schema NOT IN ('pg_catalog', 'information_schema')
ORDER BY tc.constraint_schema, tc.table_name, tc.constraint_name, kcu.ordinal_position;

-- ----------------------------------------------------------------------------
-- 3. Foreign keys
-- ----------------------------------------------------------------------------
-- Returns one row per column of every FOREIGN KEY constraint, including the
-- referenced (target) column. Self-referencing and circular foreign keys are
-- supported because source and target are joined independently.
--
-- Columns: table_schema, table_name, constraint_name, column_name,
--          column_position, foreign_table_schema, foreign_table_name,
--          foreign_column_name, foreign_column_position, update_rule,
--          delete_rule
SELECT
    src.constraint_schema                                AS table_schema,
    src.table_name                                       AS table_name,
    rc.constraint_name                                   AS constraint_name,
    src.column_name                                      AS column_name,
    src.ordinal_position                                 AS column_position,
    tgt.constraint_schema                                AS foreign_table_schema,
    tgt.table_name                                       AS foreign_table_name,
    tgt.column_name                                      AS foreign_column_name,
    tgt.ordinal_position                                 AS foreign_column_position,
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
WHERE src.constraint_schema NOT IN ('pg_catalog', 'information_schema')
ORDER BY src.constraint_schema, src.table_name, rc.constraint_name, src.ordinal_position;

-- ----------------------------------------------------------------------------
-- 4. Unique constraints
-- ----------------------------------------------------------------------------
-- Returns one row per column of every UNIQUE constraint.
-- Composite unique constraints produce one row per column.
-- Columns: table_schema, table_name, constraint_name, column_name,
--          column_position
SELECT
    tc.constraint_schema                                 AS table_schema,
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
  AND tc.constraint_schema NOT IN ('pg_catalog', 'information_schema')
ORDER BY tc.constraint_schema, tc.table_name, tc.constraint_name, kcu.ordinal_position;

-- ----------------------------------------------------------------------------
-- 5. Indexes
-- ----------------------------------------------------------------------------
-- Returns one row per column of every index on a base table. Constraints that
-- are backed by an index (PRIMARY KEY, UNIQUE) appear with is_primary /
-- is_unique set accordingly so callers can filter them out if desired.
--
-- Composite indexes preserve column order via generate_subscripts(indkey).
--
-- Columns: table_schema, table_name, index_name, column_name,
--          column_position, is_unique, is_primary, is_valid,
--          index_type, index_definition
SELECT
    ns.nspname                                          AS table_schema,
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
WHERE ns.nspname NOT IN ('pg_catalog', 'information_schema')
  AND c.relkind = 'r'
ORDER BY ns.nspname, c.relname, ic.relname, g.s;
