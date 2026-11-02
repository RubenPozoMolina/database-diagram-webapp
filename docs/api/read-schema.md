# Read-Schema API Endpoint Specification

**Ticket:** TASK-055  
**Parent story:** STORY-017 (US-4.2 Read Schema)  
**Status:** Design (v1.0)  
**Owner:** Software Architect  
**Depends on:** TASK-051 (Test-Connection API specification)

## 1. Overview

The browser cannot open a direct TCP connection to PostgreSQL, so a lightweight local backend exposes a minimal API for PostgreSQL communication. This document specifies the **read-schema** endpoint, which introspects a PostgreSQL schema and returns its structure in a format the frontend can render as a database diagram.

- **Purpose:** Allow the frontend to import an existing PostgreSQL schema as an editable diagram by retrieving tables, columns, data types, primary keys, foreign keys, unique constraints, and indexes.
- **HTTP method:** `POST`
- **URL:** `/api/read-schema`
- **Content-Type:** `application/json`
- **Authentication:** None (public application, no user roles).
- **Credential scope:** Credentials are used only for this request; they are never logged, never persisted to disk, and never written to JSON files (see PRD §5.2, §7.4).
- **Read-only:** The endpoint only performs `SELECT` queries against the PostgreSQL catalogs (`information_schema`, `pg_catalog`). No DDL or DML is generated or executed here.

## 2. Request Format

| Field    | Type     | Required | Default | Description                              | Example      |
|----------|----------|----------|---------|------------------------------------------|--------------|
| host     | string   | Yes      | —       | PostgreSQL server hostname/IP            | `localhost`  |
| port     | integer  | No       | `5432`  | PostgreSQL server port (`1..65535`)      | `5432`       |
| database | string   | Yes      | —       | Target database name                     | `mydb`       |
| user     | string   | Yes      | —       | Database user                            | `app_user`   |
| password | string   | Yes      | —       | User password (any characters)           | `s3cr3t`     |
| schema   | string   | No       | `public`| Schema to introspect (non-system)        | `public`     |

**Example request body:**

```json
{
  "host": "localhost",
  "port": 5432,
  "database": "mydb",
  "user": "app_user",
  "password": "s3cr3t",
  "schema": "public"
}
```

### Validation rules

- `host`: non-empty string; must resolve or be reachable.
- `port`: integer in range `1..65535`; default PostgreSQL port is `5432`.
- `database`: non-empty string.
- `user`: non-empty string.
- `password`: non-empty string (may contain any characters).
- `schema`: non-empty string; defaults to `public`. System schemas (`pg_catalog`, `information_schema`) are excluded from the result.

No connection attempt is made when validation fails (§4.2).

## 3. Response Format

### 3.1 Success — schema introspected

**Status:** `200 OK`

```json
{
  "success": true,
  "schema": "public",
  "tables": [
    {
      "name": "orders",
      "columns": [
        {
          "name": "order_id",
          "dataType": "integer",
          "isNullable": false,
          "columnDefault": null,
          "maxLength": null,
          "numericPrecision": 32,
          "numericScale": 0
        },
        {
          "name": "customer_id",
          "dataType": "integer",
          "isNullable": false,
          "columnDefault": null,
          "maxLength": null,
          "numericPrecision": 32,
          "numericScale": 0
        },
        {
          "name": "order_date",
          "dataType": "timestamp without time zone",
          "isNullable": false,
          "columnDefault": "CURRENT_TIMESTAMP",
          "maxLength": null,
          "datetimePrecision": 6,
          "intervalType": null
        }
      ],
      "primaryKeys": [
        {
          "constraintName": "orders_pkey",
          "columns": ["order_id"]
        }
      ],
      "foreignKeys": [
        {
          "constraintName": "orders_customer_id_fkey",
          "column": "customer_id",
          "foreignTable": "customers",
          "foreignColumn": "customer_id",
          "updateRule": "CASCADE",
          "deleteRule": "RESTRICT"
        }
      ],
      "uniqueConstraints": [
        {
          "constraintName": "orders_order_number_key",
          "columns": ["order_number"]
        }
      ],
      "indexes": [
        {
          "name": "idx_orders_customer_id",
          "columns": ["customer_id"],
          "isUnique": false,
          "isPrimary": false,
          "isValid": true,
          "indexType": "btree",
          "definition": "CREATE INDEX idx_orders_customer_id ON public.orders USING btree (customer_id)"
        },
        {
          "name": "orders_pkey",
          "columns": ["order_id"],
          "isUnique": true,
          "isPrimary": true,
          "isValid": true,
          "indexType": "btree",
          "definition": "CREATE UNIQUE INDEX orders_pkey ON public.orders USING btree (order_id)"
        }
      ]
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | `true` when introspection succeeded. |
| `schema` | string | The schema that was introspected (echo of the request `schema` or its default). |
| `tables` | array | One entry per base table in the schema, ordered by table name. |
| `tables[].name` | string | Table name. |
| `tables[].columns` | array | One entry per column, ordered by `ordinal_position`. |
| `tables[].columns[].dataType` | string | PostgreSQL data type as reported by the catalog (e.g. `integer`, `text`, `timestamp without time zone`). |
| `tables[].primaryKeys` | array | One entry per PRIMARY KEY constraint. Composite keys appear as a single entry with multiple columns, ordered by `ordinal_position`. |
| `tables[].foreignKeys` | array | One entry per FOREIGN KEY constraint column, including the referenced table/column and referential actions. Self-referencing and circular keys are supported. |
| `tables[].uniqueConstraints` | array | One entry per UNIQUE constraint. Composite constraints appear as a single entry with multiple columns. |
| `tables[].indexes` | array | One entry per index on the table. Constraints backed by an index (PRIMARY KEY, UNIQUE) are included with `isPrimary` / `isUnique` set accordingly so callers can filter them out if desired. |

### 3.2 Failure — introspection could not be completed

**Status:** `400 Bad Request` for malformed or incomplete request body;  
**Status:** `401 Unauthorized` for invalid credentials / rejected connection;  
**Status:** `502 Bad Gateway` / `503 Service Unavailable` for backend-to-database network errors;  
**Status:** `504 Gateway Timeout` if the introspection exceeds the timeout;  
**Status:** `500 Internal Server Error` for unexpected backend errors.

**Failure response body (all error statuses):**

```json
{
  "success": false,
  "error": "descriptive error message"
}
```

**Example failure responses:**

```json
// 400 Missing required field
{
  "success": false,
  "error": "Validation error: field \"password\" is required."
}

// 401 Invalid credentials
{
  "success": false,
  "error": "Authentication failed: password authentication failed for user \"app_user\"."
}

// 502 Database unreachable
{
  "success": false,
  "error": "Unable to reach PostgreSQL server at localhost:5432: connection refused."
}

// 504 Introspection timeout
{
  "success": false,
  "error": "Schema introspection timed out after 30 seconds."
}
```

| `success` | `error` presence | Meaning |
|-----------|------------------|---------|
| `true`    | absent           | Introspection succeeded. |
| `false`   | present          | Introspection failed; `error` describes why. |

## 4. Error Handling

### 4.1 Invalid credentials (401)

When PostgreSQL rejects the credentials (wrong password, unknown user, insufficient privileges, unknown database), the backend returns `401 Unauthorized` with a descriptive error message derived from the PostgreSQL authentication error. The password is never echoed back in the response.

### 4.2 Malformed or incomplete request (400)

When the request body is missing required fields, contains wrong types, or invalid values (e.g. port out of range), the backend returns `400 Bad Request` listing the invalid fields. No connection attempt is made.

### 4.3 Network / unreachable server (502 / 503)

When the backend cannot reach the PostgreSQL server (connection refused, DNS resolution failure, network unreachable), it returns `502 Bad Gateway` or `503 Service Unavailable` with a message indicating the host and port that could not be reached.

### 4.4 Introspection timeout (504)

If the introspection does not complete within the configured timeout (default **30 seconds**), the backend aborts the attempt and returns `504 Gateway Timeout`. The timeout is higher than for test-connection because introspecting a large schema can take longer than a single connection test.

### 4.5 Unexpected errors (500)

Any unexpected backend error (e.g. missing PostgreSQL client driver, internal exception) returns `500 Internal Server Error` with a generic message that does not leak stack traces or internals to the client.

### 4.6 Error message guidelines

- Error messages must be **descriptive and actionable** for the end user.
- Error messages must **never include the password** or any portion of it.
- Error messages must **never leak stack traces, internal paths, or driver internals**.
- The frontend must treat any response with `success: false` as a failed introspection and surface the `error` string to the user.

## 5. Security Considerations

| Concern | Requirement |
|---------|-------------|
| Credential logging | The `password` field must never be written to access logs, application logs, or error responses. |
| Credential persistence | Credentials are held in memory for the duration of the request only; never written to disk, database, or browser storage. |
| JSON exclusion | Connection credentials are never included in exported diagram JSON (PRD US-2.3). |
| Read-only access | The backend only issues `SELECT` queries against the PostgreSQL catalogs; no DDL/DML is generated or executed. Credentials require no special privileges beyond catalog read access. |
| No authentication | The endpoint itself requires no authentication (public application, PRD §5.4). |

## 6. Backend Implementation Notes

- Use a PostgreSQL client driver appropriate to the chosen backend language/runtime (open source only, PRD §6). The current stack is Node.js + Express + `pg` (node-postgres).
- Attempt a real TCP connection + authentication to PostgreSQL 14+; do not merely validate the format of the inputs.
- Use read-only transactions (`BEGIN READ ONLY; ... COMMIT`) for all catalog queries so the introspection cannot modify the database.
- Query only `information_schema` and `pg_catalog`; never parse raw SQL text.
- Exclude system schemas (`pg_catalog`, `information_schema`) by default.
- Support composite keys, self-referencing foreign keys, and circular dependencies via `key_column_usage` / `constraint_column_usage` with `ordinal_position`.
- Apply a bounded introspection timeout (default 30s) so the frontend is not blocked indefinitely.
- Close the database connection immediately after introspection completes (success or failure).
- Return tables, columns (with data types), primary keys, foreign keys, unique constraints, and indexes in a single response so the frontend can render the complete diagram in one round trip.
- Keep the backend minimal: this is one of three endpoints (test connection, read schema, apply schema; PRD §5.5).

## 7. Acceptance Criteria Mapping

| AC | How this spec satisfies it |
|----|----------------------------|
| API endpoint specification is documented | This document (`docs/api/read-schema.md`). |
| Response includes tables, columns, data types | §3.1 Response Format (`tables`, `columns`, `dataType`). |
| Response includes primary keys, foreign keys | §3.1 Response Format (`primaryKeys`, `foreignKeys`). |
| Response includes unique constraints, indexes | §3.1 Response Format (`uniqueConstraints`, `indexes`). |
| Error handling for connection failures is defined | §4 Error Handling (§4.1–§4.5: 401, 400, 502/503, 504, 500). |

## 8. Design Decisions & Trade-offs

| Decision | Rationale |
|----------|-----------|
| Single `POST /api/read-schema` endpoint | Consistent with the existing trunk route (`POST /api/read-schema`) and the minimal-API principle (PRD §5.5). |
| Credentials in request body (not session) | Mirrors test-connection (TASK-051); credentials are per-request, session-scoped by the frontend (PRD US-3.4). |
| `schema` parameter optional, default `public` | Most users introspect the `public` schema; allowing an explicit schema supports multi-schema databases without breaking the default case. |
| Indexes include constraint-backed indexes | `isPrimary` / `isUnique` flags let callers filter out indexes that duplicate primary-key / unique-constraint information, avoiding redundant UI rendering. |
| 30s default timeout (vs 10s for test-connection) | Introspecting many tables is slower than a single connection test; a higher timeout avoids spurious failures on large schemas. |
| Read-only transaction | Guarantees the introspection cannot mutate the target database, satisfying the "no drops / no accidental changes" reliability requirement (PRD §5.3). |
