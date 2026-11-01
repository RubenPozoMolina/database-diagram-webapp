# Test-Connection API Endpoint Specification

**Ticket:** TASK-051  
**Parent story:** STORY-016 (US-4.1 Test Connection)  
**Status:** Design (v1.0)  
**Owner:** Software Architect

## 1. Overview

The browser cannot open a direct TCP connection to PostgreSQL, so a lightweight local backend exposes a minimal API for PostgreSQL communication. This document specifies the **test-connection** endpoint, which validates PostgreSQL connection credentials without persisting them.

- **Purpose:** Allow the frontend to verify that a supplied set of PostgreSQL credentials can establish a connection before the user attempts schema import/export.
- **HTTP method:** `POST`
- **URL:** `/api/v1/connections/test`
- **Content-Type:** `application/json`
- **Authentication:** None (public application, no user roles).
- **Credential scope:** Credentials are used only for this request; they are never logged, never persisted to disk, and never written to JSON files (see PRD §5.2, §7.4).

## 2. Request Format

| Field   | Type     | Required | Description                     | Example            |
|---------|----------|----------|---------------------------------|--------------------|
| host    | string   | Yes      | PostgreSQL server hostname/IP   | `localhost`        |
| port    | integer  | Yes      | PostgreSQL server port          | `5432`             |
| database| string   | Yes      | Target database name            | `mydb`             |
| user    | string   | Yes      | Database user                   | `app_user`         |
| password| string   | Yes      | User password                   | `s3cr3t`           |

**Example request body:**

```json
{
  "host": "localhost",
  "port": 5432,
  "database": "mydb",
  "user": "app_user",
  "password": "s3cr3t"
}
```

### Validation rules

- `host`: non-empty string; must resolve or be reachable.
- `port`: integer in range `1..65535`; default PostgreSQL port is `5432`.
- `database`: non-empty string.
- `user`: non-empty string.
- `password`: non-empty string (may contain any characters).

## 3. Response Format

### 3.1 Success — connection established

**Status:** `200 OK`

```json
{
  "success": true,
  "message": "Connection to PostgreSQL established successfully."
}
```

### 3.2 Failure — connection could not be established

**Status:** `401 Unauthorized` for invalid credentials / rejected connection;  
**Status:** `400 Bad Request` for malformed or incomplete request body;  
**Status:** `502 Bad Gateway` / `503 Service Unavailable` for backend-to-database network errors;  
**Status:** `504 Gateway Timeout` if the connection attempt exceeds the timeout;  
**Status:** `500 Internal Server Error` for unexpected backend errors.

**Failure response body (all error statuses):**

```json
{
  "success": false,
  "error": "descriptive error message"
}
```

| `success` | `error` presence | Meaning                              |
|-----------|------------------|--------------------------------------|
| `true`    | absent           | Connection succeeded.                |
| `false`   | present          | Connection failed; `error` describes why. |

**Example failure responses:**

```json
// 401 Invalid credentials
{
  "success": false,
  "error": "Authentication failed: password authentication failed for user \"app_user\"."
}

// 400 Missing required field
{
  "success": false,
  "error": "Validation error: field \"password\" is required."
}

// 502 Database unreachable
{
  "success": false,
  "error": "Unable to reach PostgreSQL server at localhost:5432: connection refused."
}

// 504 Connection timeout
{
  "success": false,
  "error": "Connection attempt timed out after 10 seconds."
}
```

## 4. Error Handling

### 4.1 Invalid credentials (401)

When PostgreSQL rejects the credentials (wrong password, unknown user, insufficient privileges), the backend returns `401 Unauthorized` with a descriptive error message derived from the PostgreSQL authentication error. The password is never echoed back in the response.

### 4.2 Malformed or incomplete request (400)

When the request body is missing required fields, contains wrong types, or invalid values (e.g. port out of range), the backend returns `400 Bad Request` listing the invalid fields. No connection attempt is made.

### 4.3 Network / unreachable server (502 / 503)

When the backend cannot reach the PostgreSQL server (connection refused, DNS resolution failure, network unreachable), it returns `502 Bad Gateway` or `503 Service Unavailable` with a message indicating the host and port that could not be reached.

### 4.4 Connection timeout (504)

If the connection attempt does not complete within the configured timeout (default **10 seconds**), the backend aborts the attempt and returns `504 Gateway Timeout`.

### 4.5 Unexpected errors (500)

Any unexpected backend error (e.g. missing PostgreSQL client driver, internal exception) returns `500 Internal Server Error` with a generic message that does not leak stack traces or internals to the client.

### 4.6 Error message guidelines

- Error messages must be **descriptive and actionable** for the end user.
- Error messages must **never include the password** or any portion of it.
- Error messages must **never leak stack traces, internal paths, or driver internals**.
- The frontend must treat any response with `success: false` as a failed connection and surface the `error` string to the user.

## 5. Security Considerations

| Concern | Requirement |
|---------|-------------|
| Credential logging | The `password` field must never be written to access logs, application logs, or error responses. |
| Credential persistence | Credentials are held in memory for the duration of the request only; never written to disk, database, or browser storage. |
| JSON exclusion | Connection credentials are never included in exported diagram JSON (PRD US-2.3). |
| Session scope | Credentials are valid only for the current browser session; they are cleared on page refresh/close (PRD US-3.4). |
| No authentication | The endpoint itself requires no authentication (public application, PRD §5.4). |

## 6. Backend Implementation Notes

- Use a PostgreSQL client driver appropriate to the chosen backend language/runtime (open source only, PRD §6).
- Attempt a real TCP connection + authentication to PostgreSQL 14+; do not merely validate the format of the inputs.
- Apply a bounded connection timeout (default 10s) so the frontend is not blocked indefinitely.
- Close the database connection immediately after the test completes (success or failure).
- Keep the backend minimal: this is one of three endpoints (test connection, read schema, apply schema; PRD §5.5).

## 7. Acceptance Criteria Mapping

| AC | How this spec satisfies it |
|----|----------------------------|
| API endpoint specification is documented | This document (`docs/api/test-connection.md`). |
| Request format includes host, port, database, user, password | §2 Request Format. |
| Response format includes success/failure and error message | §3 Response Format. |
| Error handling for invalid credentials is defined | §4 Error Handling (§4.1 invalid credentials → 401). |
