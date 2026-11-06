# Security Assessment Report — TASK-049: Credential Persistence Audit

**Ticket:** TASK-049
**Sprint:** 43
**Assignee:** security-expert
**Parent:** STORY-015 (Session-Only Credentials)
**Priority:** P0
**Status:** Completed
**Type:** Security audit (verification only — no code changes)

## Acceptance Criteria

> Database credentials are never persisted to disk or browser storage and are
> cleared on session end.

| # | Acceptance criterion | Result |
|---|---|---|
| AC1 | No credentials found in localStorage or sessionStorage | **PASS** |
| AC2 | No credentials found in IndexedDB or cookies | **PASS** |
| AC3 | No credentials written to disk | **PASS** |
| AC4 | Credentials cleared after session end | **PASS** |
| AC5 | Security audit report is produced | **PASS** (this report) |

## Scope and Methodology

The audit verified the session-only credential controls implemented in
TASK-047 (session-only credential storage) and TASK-048 (credential clearing
on session end), both of which are `done`. No source code was modified in this
ticket; the deliverable is this verification report plus supporting test
evidence.

Verification techniques used:

1. **Static code analysis** — reviewed every source file that handles
   credentials for writes to durable storage (`localStorage`, `sessionStorage`,
   IndexedDB, cookies, filesystem).
2. **Unit tests (Vitest, jsdom)** — `node:20-alpine` container.
3. **End-to-end test (Playwright, Chromium)** — containerized browser against
   the app served by `nginxinc/nginx-unprivileged:1.27-alpine` on a private
   Docker network (never published on the host).
4. **Secret scanning (Gitleaks)** — `zricethezav/gitleaks:v8.18.2` over the
   working tree (`--no-git`, source code only).

All tools ran inside Docker containers on private networks; nothing was run on
the host and no production credentials or real user data were used.

## Architecture Reviewed

Database credentials (`host`, `port`, `database`, `user`, `password`) flow as
follows and are held **in memory only**:

- `src/connection/ConnectionForm.ts` — reads the form fields (password input
  uses `type="password"`), submits via `submitConnection`, then resets the form
  on success (`form.reset()` + `setDefaults()`).
- `src/hooks/useConnection.ts` — holds credentials in React component state
  only (`setConfig(connectionConfig)`); never calls any storage API.
- `frontend/src/services/credential-store.ts` — holds credentials in a
  module-level variable; never calls `localStorage`/`sessionStorage`/IndexedDB
  cookies or any filesystem API.
- `src/connection/connectionApi.ts` — sends credentials once in a transient
  `fetch` request body to `/api/v1/connections/test`; the body is not stored.

## Findings

### Finding AC1: No credentials in localStorage or sessionStorage — PASS

**Components:** `src/hooks/useConnection.ts`,
`frontend/src/services/credential-store.ts`, `src/__tests__/useConnection.test.ts`

**Evidence:**
- Production code contains no `localStorage.setItem` / `sessionStorage.setItem`
  calls involving credentials. The only `localStorage`/`sessionStorage`
  references in `src/` are in `useConnection.test.ts`, which assert the stores
  are empty after connect (`localStorage.length === 0`,
  `sessionStorage.length === 0`).
- `credential-store.ts` (lines 14-47) never references `localStorage` or
  `sessionStorage`; it stores credentials in a module-level variable and
  clears them on `beforeunload`.
- `useConnection.ts` (lines 60-137) stores credentials in React state only and
  wipes them on `beforeunload`/`pagehide`; no storage API is used.
- Unit test `"does not persist credentials to localStorage"` and
  `"does not persist credentials to sessionStorage"` pass.

**Verdict:** Credentials are never written to `localStorage` or `sessionStorage`.

### Finding AC2: No credentials in IndexedDB or cookies — PASS

**Components:** entire `src/` and `frontend/src/`

**Evidence:**
- Static search for `indexedDB`, `webkitIndexedDB`, `openDatabase`,
  `localforage`, `chrome.storage`, `document.cookie`, `.cookie` returned **no
  matches** in any production source file.
- No IndexedDB database is opened and no cookies are set by the application.

**Verdict:** The application does not use IndexedDB or cookies, so no
credentials can be stored there.

### Finding AC3: No credentials written to disk — PASS

**Components:** entire `src/` and `frontend/src/`

**Evidence:**
- Static search for `fs.writeFile`, `writeFileSync`, `appendFile`,
  `createWriteStream`, `require("fs")` returned **no matches** in production
  source code. The only `fs.readFileSync` occurrences are in e2e test files
  (`e2e/export-json.spec.ts`, `e2e/index-visual-qa.spec.ts`,
  `e2e/visual-qa-export.spec.ts`) that read downloaded diagram JSON exports
  from the browser downloads folder — they do not write credentials.
- `credential-store.ts` and `useConnection.ts` perform no filesystem operations.
- The frontend is served as static assets; nothing is written to disk by the
  app at runtime.
- Gitleaks secret scan found **no real credentials** in source code (see
  Security Scanning below).

**Verdict:** Credentials are never written to disk.

### Finding AC4: Credentials cleared after session end — PASS

**Components:** `src/hooks/useConnection.ts`,
`frontend/src/services/credential-store.ts`,
`src/__tests__/useConnection.test.ts`, `e2e/credential-clearing.spec.ts`

**Evidence:**
- `useConnection.ts` registers `beforeunload` and `pagehide` listeners that
  call `disconnect()`, which sets `config` to `null`, `status` to
  `'disconnected'`, and clears `error`/`message`. Listeners are removed in the
  `useEffect` teardown; `disconnect()` is synchronous (safe in `beforeunload`);
  no `beforeunload` confirmation dialog is triggered.
- `credential-store.ts` registers a `beforeunload` listener calling
  `clearCredentials()` (module variable set to `null`).
- Unit tests pass:
  - `"clears credentials when beforeunload fires (page refresh)"`
  - `"clears credentials when pagehide fires (page close / navigation away)"`
  - `"requires a new connection after session end"`
  - `"clears credentials from memory on disconnect"`
- E2E test `"clears credentials on page refresh and requires a new connection"`
  passes in real Chromium: after `page.reload()`, the success status and
  connection info are gone, the Disconnect button is not visible, the form
  fields are empty, and the Connect button is shown again (a new connection is
  required).

**Verdict:** Credentials are cleared on session end (refresh, close, or
navigation away) and are not recoverable; a new connection is required.

### Finding AC5: Security audit report produced — PASS

This report (`reports/security/TASK-049-credential-persistence-audit.md`)
documents the audit, evidence, and verdicts for all acceptance criteria.

## Security Scanning

### Gitleaks (secret scanning)

- **Image:** `zricethezav/gitleaks:v8.18.2`
- **Command:** `gitleaks detect --source /work --no-git --report-format json`
- **Target:** Working tree source code only (`--no-git` excludes history)
- **Result:** 2 matches, both false positives:
  1. `qa-artifacts/TASK-036/interaction_test.py` — `password_type == "password"`
     (a string comparison in a git-ignored QA artifact; not a secret).
  2. `reports/security/STORY-011-no-credentials-in-json.md` — documents the
     same past false positive (`password_type == "password"`); not a secret.
- **Assessment:** 0 real secrets or credentials found in source code. Both
  matches are the low-entropy string `"password"` in a comparison context
  (entropy 2.92), not actual credentials.

### Semgrep (SAST)

No new Semgrep rule was added for this audit because no new source code was
introduced; existing controls (in-memory-only storage, no storage-API usage)
were verified by static review and tests instead. A Semgrep rule guarding
against storage-API writes of credential fields is recommended below.

### Unit Tests (Vitest)

- **Image:** `node:20-alpine`
- **Command:** `./node_modules/.bin/vitest run` (root `src/` and `frontend/`)
- **Result:** root `src/`: 26 files, 328 tests passed, 0 failed — including
  `src/__tests__/useConnection.test.ts` (17 tests, 3 covering TASK-048 session
  clearing). `frontend/`: 4 files, 13 tests passed, 0 failed — including
  `src/services/credential-store.test.ts` (7 tests covering in-memory-only
  storage and no `localStorage`/`sessionStorage` writes).
- Credential-specific tests passing: 7 (credential-store) + 17 (useConnection)
  = 24 tests directly covering AC1-AC4.

### End-to-End Test (Playwright)

- **Image:** `mcr.microsoft.com/playwright:v1.49.1-noble`
- **Browser:** Chromium (containerized)
- **App server:** `nginxinc/nginx-unprivileged:1.27-alpine` serving `dist/`
  on a private Docker network (`qa-TASK-049`, `--internal`), never published
  on the host
- **Command:** `npx playwright@1.49.1 test e2e/credential-clearing.spec.ts`
  with `BASE_URL=http://app-TASK-049:8080/`
- **Result:** 2 tests passed, 0 failed:
  - connection form fields and controls fully visible
  - credentials cleared on page refresh; new connection required

## Remediation

No remediation required — all acceptance criteria are satisfied by the existing
implementation (TASK-047 + TASK-048) and verified by this audit.

## Recommendations

1. Keep the in-memory-only credential storage (`useConnection` React state,
   `credential-store` module variable) and the `beforeunload`/`pagehide`
   clearing in place.
2. Add a Semgrep rule that flags any call to `localStorage.setItem`,
   `sessionStorage.setItem`, IndexedDB, `document.cookie`, or filesystem write
   APIs within files that handle `password`/`DbCredentials`, to prevent
   regressions.
3. Run Gitleaks before every push to the trunk (pre-commit hook or CI gate) to
   catch accidentally committed credentials.
4. Continue running the `credential-clearing.spec.ts` E2E test in CI to guard
   against session-clearing regressions.
5. The `ConnectionForm` password field already uses `type="password"`; consider
   adding `autocomplete="new-password"` to discourage browser password managers
   from storing connection credentials.

## Risk Rating

**Overall: Low** — Database credentials are held in memory only for the current
session, never written to `localStorage`, `sessionStorage`, IndexedDB, cookies,
or disk, and are cleared on `beforeunload`/`pagehide`. Multiple independent
controls enforce this, and 24 unit tests plus 2 E2E tests verify it.

## Evidence

- Report: `reports/security/TASK-049-credential-persistence-audit.md` (this file)
- Code reviewed: `src/hooks/useConnection.ts`,
  `frontend/src/services/credential-store.ts`,
  `src/connection/ConnectionForm.ts`,
  `src/connection/connectionApi.ts`
- Unit test report: root `src/` 26 files / 328 tests passed; `frontend/`
  4 files / 13 tests passed (run in `node:20-alpine` container,
  `./node_modules/.bin/vitest run`)
- E2E test report: `e2e/credential-clearing.spec.ts` — 2 tests passed in
  containerized Chromium (`mcr.microsoft.com/playwright:v1.49.1-noble`) against
  app served by `nginxinc/nginx-unprivileged:1.27-alpine` on private network
  `qa-TASK-049`
- Gitleaks report: `zricethezav/gitleaks:v8.18.2`, 2 findings both false
  positives, 0 real secrets (scan output not retained — contains no secrets)
- Static analysis: grep for `localStorage`/`sessionStorage`/`indexedDB`/
  `document.cookie`/`fs.write*` — no production-code matches
- Docker commands and image tags recorded above; containers and networks
  removed after use
