# Security Assessment Report — STORY-011: No Credentials in JSON

**Ticket:** STORY-011
**Sprint:** 25
**Assignee:** security-expert
**Priority:** P0
**Status:** Completed

## Acceptance Criteria

> Given a diagram is exported to JSON, when the JSON file is inspected, then
> no host, port, database, user, or password fields are present

**Result: PASS** — Verified by code review, unit tests, and security scanning.

## Findings

### Finding 1: Credential absence verified (PASS)

**Component:** `src/serialization/diagramSerializer.ts`, `src/components/ExportButton.tsx`

**Evidence:**
- `serializeDiagram()` constructs the export payload from the `Diagram` model
  which contains only `id`, `name`, `tables`, and `relationships` — no
  connection fields (`host`, `port`, `database`, `user`, `password`).
- `src/schema/diagram.schema.json` uses `additionalProperties: false` at every
  level, rejecting any undeclared fields.
- `ExportButton.tsx` calls `serializeDiagram()` directly with no credential
  augmentation.
- Unit test `src/serialization/diagramSerializer.test.ts`:
  `"contains no database credentials (host, port, database, user, password)"`
  asserts the serialized JSON string contains none of the credential fields.

**Verdict:** No credentials in JSON export. Acceptance criteria met.

### Finding 2: Defense-in-depth credential sanitizer (IMPLEMENTED)

**Component:** `src/serialization/diagramSerializer.ts`

**Description:** Added `stripCredentials()` — a recursive guard that removes any
`host`, `port`, `database`, `user`, or `password` fields from the export
payload before it is returned. Applied as the final step in `serializeDiagram()`.

**Rationale:** Even if the `Diagram` model is later extended to carry
connection details, this guard ensures credentials can never reach the JSON
export. Defense-in-depth complements the type-level and schema-level protections.

**Evidence:** New unit tests in `diagramSerializer.test.ts`:
- `stripCredentials removes credential fields from nested objects`
- `stripCredentials preserves arrays of non-credential objects`
- `serializeDiagram strips credentials even if injected into the diagram`

### Finding 3: Credentials held in memory only (PASS)

**Component:** `src/hooks/useConnection.ts`

**Evidence:** Connection credentials (`host`, `port`, `database`, `user`,
`password`) are stored in React component state only, never persisted to
`localStorage`, `sessionStorage`, IndexedDB, cookies, or any durable storage.
`disconnect()` wipes credentials from memory. Verified by existing tests in
`src/__tests__/useConnection.test.ts` ("does not persist credentials to
localStorage", "clears credentials from memory on disconnect").

**Verdict:** Credentials are never written to durable browser storage, so they
cannot be indirectly exported to JSON via persistence.

## Security Scanning

### Gitleaks (secret scanning)

- **Image:** `zricethezav/gitleaks:v8.18.2`
- **Command:** `gitleaks detect --source /work --no-git --report-format json`
- **Target:** Working tree (source code only, `--no-git` to exclude history)
- **Result:** 1 finding — a false positive in `qa-artifacts/TASK-036/interaction_test.py`
  (git-ignored QA artifact, not source code) matching `password_type == "password"`,
  which is a string comparison, not an actual secret.
- **Assessment:** No real secrets or credentials found in source code.

### Semgrep (SAST)

- **Image:** `returntocorp/semgrep:latest`
- **Command:** `semgrep scan --config .semgrep/credential-in-export.yaml /work/src/serialization`
- **Rules:** 2 rules (`no-credentials-in-diagram-serialization`,
  `no-credentials-in-export-button`)
- **Result:** 0 findings — no credential field assignments in serialization code.

### Unit Tests (Vitest)

- **Image:** `node:20-alpine`
- **Command:** `npx vitest run --config vitest.forceexit.config.ts`
- **Result:** All 12 test suites passed (124 tests total), including all 13 tests
  in `src/serialization/diagramSerializer.test.ts`.

## Remediation

No remediation required — the acceptance criteria is satisfied by existing code
plus the defense-in-depth sanitizer added in this ticket.

## Recommendations

1. Keep the `stripCredentials()` guard in place as defense-in-depth.
2. Run Semgrep on serialization code in CI to prevent future credential field
   additions.
3. Run Gitleaks before every push to the trunk (pre-commit hook or CI gate).
4. The `Diagram` type should remain free of connection fields; any future need
   to associate a diagram with a connection should use a separate reference
   (e.g. a connection ID), never embedded credentials.

## Evidence

- Code changes: `src/serialization/diagramSerializer.ts` (added `CREDENTIAL_FIELDS`,
  `stripCredentials()`, applied in `serializeDiagram()`)
- Test changes: `src/serialization/diagramSerializer.test.ts` (3 new tests)
- Semgrep rules: `.semgrep/credential-in-export.yaml`
- Test report: all vitest suites passed (run in `node:20-alpine` container)
- Gitleaks report: `qa-artifacts/gitleaks-report.json` (1 false positive only)
- Semgrep report: 0 findings on `src/serialization/`

## Risk Rating

**Overall: Low** — Credentials are never written to JSON export. Multiple
independent controls (type model, JSON schema, runtime sanitizer) enforce this.
