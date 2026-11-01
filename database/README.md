# Database layer — PostgreSQL schema introspection

This directory owns the PostgreSQL schema introspection queries used to import a
live database schema into the diagram model (ticket `TASK-039`, story `STORY-013`,
PRD `US-3.2`).

## Files

| File | Purpose |
|------|---------|
| `introspection.sql` | Read-only SQL queries that introspect tables/columns, data types, primary keys, foreign keys, unique constraints and indexes. |
| `seed.sql` | Throwaway seed schema used to verify the queries (composite keys, self-referencing and circular foreign keys, reserved-word table names, multiple data types). |
| `verify-introspection.sql` | Runs every introspection query against the seed schema, one result block per query. |
| `run-verification.sh` | Starts a throwaway `postgres:16-alpine` container on a private Docker network, seeds the schema, runs the verification and cleans up. |

## Queries (`introspection.sql`)

1. **Tables and columns** — `information_schema.tables` + `information_schema.columns`
   (includes `data_type`, lengths, precision/scale, nullability, defaults).
2. **Primary keys** — `table_constraints` (`PRIMARY KEY`) + `key_column_usage`.
3. **Foreign keys** — `referential_constraints` + `key_column_usage` on both sides
   (supports single/composite keys, self-references and circular dependencies).
4. **Unique constraints** — `table_constraints` (`UNIQUE`) + `key_column_usage`.
5. **Indexes** — `pg_catalog` (`pg_index`, `pg_class`, `pg_attribute`, `pg_am`); composite
   indexes preserve column order via `generate_subscripts(indkey)`. Constraint-backed
   indexes are flagged with `is_primary` / `is_unique` so callers can filter them.

All queries are **read-only** (`SELECT` only) and are meant to run inside a
`BEGIN READ ONLY` transaction. System schemas (`pg_catalog`, `information_schema`)
are excluded by default.

## Placeholder convention

The queries use `$n` placeholders (lib/pq, pgx, node-postgres already use `$n`).
Adapt to your driver before use:
- node-postgres (`pg`) — `$1` (already `$n`)
- psycopg (Python) — `%(schema)s` or `$1`
- JDBC — `?`

To introspect a single caller-supplied schema, replace
`NOT IN ('pg_catalog', 'information_schema')` with `= $1` (driver placeholder
as appropriate).

## Compatibility

PostgreSQL 14+. Verified against `postgres:16-alpine` inside a throwaway Docker
container (no host port published, per-run generated password, `tmpfs` data dir).

## Verification

Run the full verification inside Docker:

```bash
./database/run-verification.sh
```

It starts a `postgres:16-alpine` container on a private network, seeds
`database/seed.sql`, runs every introspection query, and removes the container
and network when done. No database port is published on the host and no
credentials are written to disk.

## Round-trip note

These queries feed the import path. The matching export path (DDL generation)
is covered by ticket `TASK-043`. Together they satisfy the round-trip acceptance
criterion: database → import → model → export → empty database yields an
equivalent schema.
