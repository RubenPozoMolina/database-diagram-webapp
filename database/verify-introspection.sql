-- ============================================================================
-- Verification script for TASK-039 introspection queries
-- Run against the seeded database (database/seed.sql).
-- Each block prints a marker line then the query result so output can be
-- parsed and asserted by the shell wrapper.
-- ============================================================================

\echo '===MARKER:TABLES_AND_COLUMNS==='
SELECT
    table_schema, table_name, column_name, column_position, is_nullable,
    data_type, character_maximum_length, numeric_precision, numeric_scale,
    udt_name
FROM (
    SELECT
        t.table_schema, t.table_name, c.column_name, c.ordinal_position AS column_position,
        c.is_nullable, c.data_type, c.character_maximum_length,
        c.numeric_precision, c.numeric_scale, c.udt_name
    FROM information_schema.tables AS t
    JOIN information_schema.columns AS c
      ON c.table_catalog = t.table_catalog
     AND c.table_schema  = t.table_schema
     AND c.table_name    = t.table_name
    WHERE t.table_type = 'BASE TABLE'
      AND t.table_schema NOT IN ('pg_catalog', 'information_schema')
) s
ORDER BY table_schema, table_name, column_position;

\echo '===MARKER:PRIMARY_KEYS==='
SELECT
    table_schema, table_name, constraint_name, column_name, column_position
FROM (
    SELECT
        tc.constraint_schema AS table_schema, tc.table_name,
        tc.constraint_name, kcu.column_name, kcu.ordinal_position AS column_position
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON kcu.constraint_catalog = tc.constraint_catalog
     AND kcu.constraint_schema  = tc.constraint_schema
     AND kcu.constraint_name    = tc.constraint_name
     AND kcu.table_name         = tc.table_name
    WHERE tc.constraint_type = 'PRIMARY KEY'
      AND tc.constraint_schema NOT IN ('pg_catalog', 'information_schema')
) s
ORDER BY table_schema, table_name, constraint_name, column_position;

\echo '===MARKER:FOREIGN_KEYS==='
SELECT
    table_schema, table_name, constraint_name, column_name, column_position,
    foreign_table_schema, foreign_table_name, foreign_column_name,
    foreign_column_position, update_rule, delete_rule
FROM (
    SELECT
        src.constraint_schema AS table_schema, src.table_name,
        rc.constraint_name, src.column_name, src.ordinal_position AS column_position,
        tgt.constraint_schema AS foreign_table_schema, tgt.table_name AS foreign_table_name,
        tgt.column_name AS foreign_column_name, tgt.ordinal_position AS foreign_column_position,
        rc.update_rule, rc.delete_rule
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
) s
ORDER BY table_schema, table_name, constraint_name, column_position;

\echo '===MARKER:UNIQUE_CONSTRAINTS==='
SELECT
    table_schema, table_name, constraint_name, column_name, column_position
FROM (
    SELECT
        tc.constraint_schema AS table_schema, tc.table_name,
        tc.constraint_name, kcu.column_name, kcu.ordinal_position AS column_position
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON kcu.constraint_catalog = tc.constraint_catalog
     AND kcu.constraint_schema  = tc.constraint_schema
     AND kcu.constraint_name    = tc.constraint_name
     AND kcu.table_name         = tc.table_name
    WHERE tc.constraint_type = 'UNIQUE'
      AND tc.constraint_schema NOT IN ('pg_catalog', 'information_schema')
) s
ORDER BY table_schema, table_name, constraint_name, column_position;

\echo '===MARKER:INDEXES==='
SELECT
    table_schema, table_name, index_name, column_name, column_position,
    is_unique, is_primary, is_valid, index_type
FROM (
    SELECT
        ns.nspname AS table_schema, c.relname AS table_name,
        ic.relname AS index_name, a.attname AS column_name,
        g.s + 1 AS column_position, i.indisunique AS is_unique,
        i.indisprimary AS is_primary, i.indisvalid AS is_valid,
        am.amname AS index_type
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
) s
ORDER BY table_schema, table_name, index_name, column_position;
