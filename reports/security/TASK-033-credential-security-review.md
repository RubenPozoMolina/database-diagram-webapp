# Security Assessment Report — TASK-033: Credential Security Review of JSON Serialization

**Ticket:** TASK-033
**Sprint:** 54
**Assignee:** project-manager
**Priority:** P0
**Parent:** STORY-011 (No Credentials in JSON)
**Dependency:** TASK-026 (JSON serialization)
**Status:** Completed

## Scope

Conduct a security review of all JSON serialization code paths to verify that
database credentials (host, port, database, user, password) are never included
in JSON export output, addressing PRD requirement F7 ("Session-only database
credentials — never stored, never in JSON") and user story US-2.3 ("No
Credentials in JSON").

## Acceptance Criteria

| # | Criterion | Result |
|---|-----------|--------|
| 1 | JSON serialization code paths are reviewed for credential fields | PASS |
| 2 | No host, port, database, user, or password fields appear in JSON output | PASS |
| 3 | Security review document is produced | PASS (this document) |

## Reviewed Code Paths

### 1. Frontend diagram serialization — `src/serialization/diagramSerializer.ts`

**`serializeDiagram(diagram: Diagram): SerializedExport`** (line 209)
- Builds the export payload from the in-memory `Diagram` model only
  (`id`, `name`, `tables`, `relationships`, `uniqueConstraints`, `indexes`,
  `createdAt`, `updatedAt`).
- The `Diagram` type (`src/types/diagram.ts`) declares no connection or
  credential fields (`host`, `port`, `database`, `user`, `password`), so
  credentials cannot be present by construction.
- Applies `stripCredentials(exportPayload)` as the final step before returning
  (line 233), a defense-in-depth guard that recursively removes any credential
  field names even if they were somehow injected into the payload.

**`stripCredentials<T>(value: T): T`** (line 50)
- Recursive, non-mutating sanitizer.
- Traverses arrays and plain objects; primitives are returned unchanged.
- Case-insensitive matching against `CREDENTIAL_FIELDS` = {`host`, `port`,
  `database`, `user`, `password`}.
- Removed fields are excluded from the returned object; non-credential data is
  preserved.

**`CREDENTIAL_FIELDS`** (line 33)
- `new Set(['host', 'port', 'database', 'user', 'password'])` — the complete
  set of credential field names from PRD US-2.3 / F7.

### 2. Frontend JSON schema — `src/schema/diagram.schema.json`

- The root object and every `$defs` level (`Diagram`, `Table`, `Column`,
  `Relationship`, `UniqueConstraint`, `Index`) declares `"additionalProperties":
  false`.
- Any undeclared field — including any credential field — is rejected by the
  schema, providing a schema-level rejection control independent of the
  runtime sanitizer.

### 3. Frontend export UI — `src/components/ExportButton.tsx`

- `handleExport()` calls `serializeDiagram(diagram)` directly (line 10),
  serializes the result with `JSON.stringify`, and triggers a file download.
- The credential payload (`ConnectionConfig` from `src/types.ts`) lives in a
  separate module and is never passed to `serializeDiagram()` or included in
  the export blob.
- No credential field names appear anywhere in the component.

### 4. Backend API — `backend/src/routes/test-connection.ts`, `read-schema.ts`

- `test-connection.ts`: responses are `{ success, message }` or `{ success,
  error }` — credentials are used only to establish the `pg.Client` connection
  and are never echoed in the JSON response.
- `read-schema.ts`: responses contain schema metadata (tables, columns,
  constraints, indexes) only; credentials are used to connect to PostgreSQL
  and never appear in the response body.
- The `TestConnectionRequest` type (`backend/src/types/connection.ts`) carries
  credentials only on the request path, never in responses.

### 5. Frontend connection state — `src/hooks/useConnection.ts`

- `ConnectionConfig` (host, port, database, user, password) is held in React
  state only.
- Credentials are never written to `localStorage`, `sessionStorage`,
  IndexedDB, or cookies.
- `disconnect()` wipes credentials from memory; session-end handlers
  (`beforeunload`, `pagehide`) clear them on refresh/close/navigation.

## Defense-in-Depth Layering

| Layer | Mechanism | Protection |
|-------|-----------|----------|
| Type model | `Diagram` type has no credential fields | Credentials cannot be represented in the diagram model |
| JSON schema | `additionalProperties: false` at all levels | Undeclared credential fields rejected at validation |
| Runtime sanitizer | `stripCredentials()` in `serializeDiagram()` | Credential fields removed even if injected |
| SAST | Semgrep rules `.semgrep/credential-in-export.yaml` | Prevents future credential field additions in serialization code |
| Storage | `useConnection` in-memory only | Credentials never reach durable storage where they could be exported |

## Test Evidence

Unit tests (previously executed in `node:20-alpine` container via
`docker compose -f docker-compose.unit.yml run --rm tests`):

- `src/serialization/diagramSerializer.test.ts` — 19/19 passed, including:
  - `"contains no database credentials (host, port, database, user, password)"`
  - `"stripCredentials removes credential fields from nested objects"`
  - `"stripCredentials preserves arrays of non-credential objects"`
  - `"serializeDiagram strips credentials even if injected into the diagram"`
- `src/components/ExportButton.test.tsx` — 5/5 passed, including:
  - `"downloads JSON containing the complete diagram model and no credentials"`
- `src/__tests__/useConnection.test.ts` — credential in-memory-only tests passed
  ("does not persist credentials to localStorage", "clears credentials from
  memory on disconnect").

Full suite results from prior runs:
- TASK-027: 360 tests across 28 test files passed (exit code 0)
- STORY-011: all 19 test suites passed, including 13 tests in
  `diagramSerializer.test.ts`

## Security Scanning

### Semgrep (SAST)
- Config: `.semgrep/credential-in-export.yaml`
- Rules: `no-credentials-in-diagram-serialization`, `no-credentials-in-export-button`
- Result: 0 findings on `src/serialization/` (2 rules, 2 files)
- Previously verified in STORY-011 security review.

### Gitleaks (secret scanning)
- Result: 1 finding only, a false positive in a git-ignored QA artifact
  (`qa-artifacts/TASK-036/interaction_test.py`, string comparison
  `password_type == "password"`, not an actual secret).
- No secrets or credentials found in source code.

## Findings

### Finding 1: No credentials in JSON export (PASS)

**Component:** `src/serialization/diagramSerializer.ts`,
`src/components/ExportButton.tsx`

All three independent controls (type model, JSON schema, runtime sanitizer)
confirm that `host`, `port`, `database`, `user`, and `password` never appear in
the exported JSON. The export payload is constructed exclusively from diagram
data, and `stripCredentials()` provides a final defense-in-depth removal pass.

**Verdict:** No credentials in JSON export. Acceptance criteria met.

### Finding 2: Defense-in-depth credential sanitizer implemented (PASS)

**Component:** `src/serialization/diagramSerializer.ts`

`stripCredentials()` is a pure, non-mutating, recursive function applied as the
final step in `serializeDiagram()`. It uses case-insensitive key matching and
traverses nested objects and arrays, ensuring credential fields cannot reach the
JSON export even under future model extensions.

**Verdict:** Defense-in-depth control correctly implemented.

### Finding 3: Backend JSON responses do not leak credentials (PASS)

**Component:** `backend/src/routes/test-connection.ts`, `read-schema.ts`

Backend responses contain only success/failure status and schema metadata.
Credentials are used solely to establish PostgreSQL connections and are never
included in response bodies.

**Verdict:** No credential leakage via backend JSON responses.

### Finding 4: Credentials held in memory only (PASS)

**Component:** `src/hooks/useConnection.ts`

Connection credentials are stored in React state and cleared on disconnect and
session end. They are never written to durable browser storage, so they cannot
indirectly reach a JSON export via persistence.

**Verdict:** Credential storage is session-only, consistent with PRD F7.

## Recommendations

1. Keep `stripCredentials()` in place as defense-in-depth.
2. Continue running Semgrep on serialization code in CI to prevent future
   credential field additions.
3. Run Gitleaks before every push to the trunk (pre-commit hook or CI gate).
4. Keep the `Diagram` type free of connection fields; any future association
   between a diagram and a connection should use a separate reference (e.g. a
   connection ID), never embedded credentials.

## Risk Rating

**Overall: Low** — Database credentials are never written to JSON export.
Multiple independent controls (type model, JSON schema, runtime sanitizer,
SAST rules, in-memory-only storage) enforce this requirement.

## Evidence

- Code review: `src/serialization/diagramSerializer.ts` (lines 29-65, 209-233)
- Code review: `src/schema/diagram.schema.json` (`additionalProperties: false`
  at all levels)
- Code review: `src/components/ExportButton.tsx` (no credential references)
- Code review: `backend/src/routes/test-connection.ts`, `read-schema.ts` (no
  credentials in responses)
- Code review: `src/hooks/useConnection.ts` (in-memory credentials only)
- Test report: `src/serialization/diagramSerializer.test.ts` — 19/19 passed
- Test report: `src/components/ExportButton.test.tsx` — 5/5 passed
- Semgrep report: 0 findings on `src/serialization/` (2 rules)
- Gitleaks report: 1 false positive only, no real secrets in source code
