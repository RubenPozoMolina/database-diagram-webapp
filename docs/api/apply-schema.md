# Apply-Schema API Endpoint Specification

**Ticket:** TASK-060  
**Parent story:** STORY-018 (US-4.3 Apply Schema)  
**Status:** Design (v1.0)  
**Owner:** Software Architect  
**Depends on:** TASK-051 (test-connection API design)

## 1. Overview

The browser cannot open a direct TCP connection to PostgreSQL, so a lightweight local backend exposes a minimal API for PostgreSQL communication. This document specifies the **apply-schema** endpoint, which executes Data Definition Language (DDL) statements against a chosen PostgreSQL schema to realise a database diagram as a live schema.

- **Purpose:** Allow the frontend to apply validated DDL (CREATE TABLE, keys, relationships) to a PostgreSQL schema after the user has explicitly confirmed the operation. Existing database objects are never dropped or altered by the application.
- **HTTP method:** `POST`
- **URL:** `/api/v1/apply-schema`
- **Content-Type:** `application/json`
- **Authentication:** None (public application, no user roles).
- **Credential scope:** Connection credentials are used only for this request; they are never logged, never persisted to disk, and never written to JSON files (see PRD §5.2, §7.4).
- **Confirmation scope:** DDL is executed only when the `confirm` field is `true`, representing explicit user confirmation after viewing the generated SQL preview (PRD US-3.3, §5.2).

## 2. Request Format

| Field    | Type     | Required | Default   | Description                                 | Example                            |
|----------|----------|----------|-----------|---------------------------------------------|------------------------------------|
| host     | string   | Yes      | —         | PostgreSQL server hostname/IP               | `localhost`                        |
| port     | integer  | No       | `5432`    | PostgreSQL server port (1..65535)           | `5432`                             |
| database | string   | Yes      | —         | Target database name                        | `mydb`                             |
| user     | string   | Yes      | —         | Database user                               | `app_user`                         |
| password | string   | Yes      | —         | User password                               | `s3cr3t`                           |
| schema   | string   | No       | `public`  | Target schema into which DDL is applied     | `public`                           |
| ddl      | string   | Yes      | —         | DDL statements to execute (CREATE only)     | `CREATE TABLE ...;`                |
| confirm  | boolean  | Yes      | —         | Explicit user confirmation to execute DDL   | `true`                             |

**Example request body:**

```json
{
  "host": "localhost",
  "port": 5432,
  "database": "mydb",
  "user": "app_user",
  "password": "s3cr3t",
  "schema": "public",
  "ddl": "CREATE TABLE departments (id serial PRIMARY KEY, name text NOT NULL);\nCREATE TABLE employees (id serial PRIMARY KEY, name text NOT NULL, department_id integer REFERENCES departments(id));",
  "confirm": true
}
```

### Validation rules

- `host`: non-empty string; must resolve or be reachable.
- `port`: integer in range `1..65535`; default PostgreSQL port is `5432`.
- `database`: non-empty string.
- `user`: non-empty string.
- `password`: non-empty string (may contain any characters).
- `schema`: non-empty string; defaults to `public` when omitted.
- `ddl`: non-empty string containing at least one DDL statement.
- `confirm`: boolean; must be `true` for DDL to be executed. When `false`, the request is rejected with a confirmation-required error and the DDL is echoed back for preview.

## 3. Response Format

### 3.1 Success — DDL applied

**Status:** `200 OK`

```json
{
  "success": true,
  "message": "Schema applied successfully.",
  "ddlPreview": "CREATE TABLE departments (...); CREATE TABLE employees (...);"
}
```

### 3.2 Failure — DDL not applied

**Status:** `400 Bad Request` for validation errors, missing confirmation, or rejected (no-drops) DDL;  
**Status:** `401 Unauthorized` for invalid credentials / rejected connection;  
**Status:** `502 Bad Gateway` / `503 Service Unavailable` for backend-to-database network errors;  
**Status:** `504 Gateway Timeout` if the DDL execution exceeds the timeout;  
**Status:** `500 Internal Server Error` for unexpected backend errors.

**Failure response body (all error statuses):**

```json
{
  "success": false,
  "error": "descriptive error message"
}
```

| `success` | `error`/`message` presence | Meaning                                                  |
|-----------|----------------------------|----------------------------------------------------------|
| `true`    | `message` present          | DDL applied successfully.                                |
| `false`   | `error` present            | DDL not applied; `error` describes why (see §4).         |

**Example failure responses:**

```json
// 400 Missing confirmation
{
  "success": false,
  "error": "Confirmation required",
  "message": "DDL must be explicitly confirmed before execution.",
  "ddlPreview": "CREATE TABLE departments (id serial PRIMARY KEY, name text NOT NULL);"
}

// 400 Rejected DROP statement (no-drops constraint)
{
  "success": false,
  "error": "Rejected",
  "message": "DROP/TRUNCATE/ALTER operations are not allowed. Existing objects are never dropped."
}

// 400 Validation error
{
  "success": false,
  "error": "Validation error: field \"ddl\" is required."
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

// 504 DDL execution timeout
{
  "success": false,
  "error": "DDL execution timed out after 30 seconds."
}
```

## 4. Error Handling

### 4.1 Missing or invalid confirmation (400)

When `confirm` is not `true`, the backend returns `400 Bad Request` with a confirmation-required error. No DDL is executed. The `ddlPreview` field echoes the submitted DDL so the frontend can re-display the preview. This enforces the explicit-user-confirmation requirement (PRD US-3.3, §5.2).

### 4.2 Malformed or incomplete request (400)

When the request body is missing required fields, contains wrong types, or invalid values (e.g. port out of range, empty DDL), the backend returns `400 Bad Request` listing the invalid fields. No connection attempt is made and no DDL is executed.

### 4.3 Invalid credentials (401)

When PostgreSQL rejects the credentials (wrong password, unknown user, insufficient privileges, unknown database), the backend returns `401 Unauthorized` with a descriptive error message derived from the PostgreSQL authentication error. The password is never echoed back in the response. No DDL is executed.

### 4.4 No-drops constraint violation (400)

When the submitted DDL contains statements that would drop or alter existing database objects (e.g. `DROP TABLE`, `DROP COLUMN`, `DROP CONSTRAINT`, `TRUNCATE`, `ALTER TABLE ... DROP ...`), the backend returns `400 Bad Request` with a rejection message. No DDL from the batch is executed. This is the API-level enforcement of the no-drops safety constraint (PRD §5.2, US-3.3, TASK-045/TASK-062). Only `CREATE` statements for new objects are permitted.

### 4.5 Network / unreachable server (502 / 503)

When the backend cannot reach the PostgreSQL server (connection refused, DNS resolution failure, network unreachable), it returns `502 Bad Gateway` or `503 Service Unavailable` with a message indicating the host and port that could not be reached. No DDL is executed.

### 4.6 DDL execution timeout (504)

If DDL execution does not complete within the configured timeout (default **30 seconds**), the backend aborts the attempt and returns `504 Gateway Timeout`. Statements already executed within the transaction may be rolled back where supported to avoid leaving partial changes (PRD §5.3).

### 4.7 Unexpected errors (500)

Any unexpected backend error (e.g. missing PostgreSQL client driver, internal exception) returns `500 Internal Server Error` with a generic message that does not leak stack traces, internal paths, or driver internals to the client.

### 4.8 Error message guidelines

- Error messages must be **descriptive and actionable** for the end user.
- Error messages must **never include the password** or any portion of it.
- Error messages must **never leak stack traces, internal paths, or driver internals**.
- The frontend must treat any response with `success: false` as a failed DDL application and surface the `error` string to the user.

## 5. No-Drops Safety Constraint (API-level enforcement)

The no-drops constraint is enforced at the API level, before any DDL reaches PostgreSQL:

1. The backend parses the submitted DDL into individual statements.
2. Each statement is inspected (case-insensitive) for `DROP`, `TRUNCATE`, or `ALTER ... DROP`/`ALTER ... MODIFY`/`ALTER ... ALTER COLUMN` patterns that would remove or alter existing objects.
3. If any statement matches a forbidden pattern, the entire request is rejected with `400 Bad Request` and no statement is executed.
4. Only `CREATE` statements for new objects (tables, columns, keys, constraints, indexes) are permitted.

This is a defense-in-depth layer complementary to the backend no-drops validation implemented in TASK-062. The API specification defines the contract; TASK-062 implements the runtime enforcement.

## 6. Security Considerations

| Concern | Requirement |
|---------|-------------|
| Credential logging | The `password` field must never be written to access logs, application logs, or error responses. |
| Credential persistence | Credentials are held in memory for the duration of the request only; never written to disk, database, or browser storage. |
| Password redaction | Any PostgreSQL error message returned to the client must have the password redacted (replaced with `***`). |
| No-drops enforcement | `DROP`, `TRUNCATE`, and object-altering `ALTER` statements are rejected at the API level (§5). |
| Confirmation required | DDL is executed only when `confirm: true`; the frontend must show the DDL preview and obtain explicit user confirmation before calling this endpoint (PRD §5.2). |
| No authentication | The endpoint itself requires no authentication (public application, PRD §5.4). |

## 7. Backend Implementation Notes

- Use a PostgreSQL client driver appropriate to the chosen backend language/runtime (open source only, PRD §6). The stack is Node.js + Express + `pg` + `zod`.
- Attempt a real TCP connection + authentication to PostgreSQL 14+; do not merely validate the format of the inputs.
- Apply a bounded execution timeout (default 30s) so the frontend is not blocked indefinitely (§4.6).
- Execute DDL within a transaction where possible so that a failure can be rolled back and no partial changes are left in an inconsistent state (PRD §5.3).
- Close the database connection immediately after execution completes (success or failure).
- Validate the request body with `zod` before any connection attempt or DDL execution (mirrors §4.2).
- Enforce the no-drops constraint at the API level before executing any statement (§5).
- Never log or return the `password` field (§4.8, §6).
- Keep the backend minimal: this is one of three endpoints (test connection, read schema, apply schema; PRD §5.5).
- Route: `POST /api/v1/apply-schema` (canonical v1 API, consistent with `POST /api/v1/connections/test` from TASK-051).

## 8. Acceptance Criteria Mapping

| AC | How this spec satisfies it |
|----|----------------------------|
| API endpoint specification is documented | This document (`docs/api/apply-schema.md`). |
| Request includes DDL statements and target schema | §2 Request Format (`ddl`, `schema` fields; lines 21-34). |
| Response includes success/failure and error message | §3 Response Format (`success`/`error`/`message`). |
| No-drops constraint is enforced at API level | §5 No-Drops Safety Constraint; §4.4 rejection of DROP/TRUNCATE/ALTER. |
| Error handling for DDL failures is defined | §4 Error Handling (400/401/502/503/504/500 with guidelines in §4.8). |
