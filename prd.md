# Product Requirements Document: Database Diagram Web Application

| Field | Value |
|---|---|
| **Product name** | database-diagram-webapp |
| **Document version** | 3.0 |
| **Status** | Baselined |
| **Date** | November 6, 2026 |
| **Author** | Product Manager Agent |
| **Source of truth** | Customer Interview, October 20, 2026 (`examples/database-diagram-webapp/customer-interview.md`) |
| **Related artifacts** | `docs/api/diagram-json-schema.md`, `docs/api/test-connection.md`, `docs/api/read-schema.md`, `docs/api/apply-schema.md`, `docs/user-guide.md` |
| **Supersedes** | PRD v2.0 (November 6, 2026) |

### Change Log

| Version | Date | Change | Author |
|---|---|---|---|
| 1.0 | 2026-10-20 | Initial PRD derived from customer interview | Product Manager Agent |
| 2.0 | 2026-11-06 | Added scope-decision log, requirement IDs, canonical JSON contract, measurable NFRs, UX requirements, validation rules, traceability matrix, and glossary; reconciled PostgreSQL scope with the interview | Product Manager Agent |
| 3.0 | 2026-11-06 | Updated to reflect current customer interview: confirmed PostgreSQL backend requirement is validated by interview (not a deviation), marked Q-1 resolved, added explicit README and Docker Compose/PostgreSQL sample-data deployment requirements, closed alignment gaps between interview and PRD | Product Manager Agent |

---

## 1. Executive Summary

**database-diagram-webapp** is a public, open-source web application that lets a database designer visually create and edit relational database diagrams, and move models in and out of the tool without vendor lock-in.

The product has two interchange paths:

1. **JSON** — a versioned, engine-neutral document that can be exported, versioned, shared, and re-imported with full fidelity.
2. **PostgreSQL** — introspection of a live schema into a diagram, and generation of DDL from a diagram with a mandatory preview and explicit confirmation before execution.

The application requires no accounts and no roles. It is a static frontend for diagramming and JSON operations, plus a deliberately minimal local backend used **only** to bridge the browser to PostgreSQL (a browser cannot open a database socket directly).

> **Scope note for reviewers:** The interview confirms that JSON file operations are fully client-side (no backend needed) while PostgreSQL connectivity requires a minimal local backend because a browser cannot open database sockets. PostgreSQL connectivity is classified as must-have in the interview. The minimal backend is therefore a confirmed v1 requirement (§3.2, D-01, D-02), not a deviation.

---

## 2. Context and Problem

### 2.1 Problem Statement

Database designers need a lightweight tool to create and edit database diagrams and to exchange database models in an agnostic way. Today they face three recurring problems:

- **Tool lock-in** — models are trapped in proprietary formats that cannot be re-imported elsewhere.
- **Heavyweight tooling** — diagramming suites require accounts, installation, or a hosted service for what should be a local design task.
- **Model/database drift** — there is no simple path from a whiteboard-style model to a real schema, or from an existing schema back to a readable diagram.

The product addresses this with a browser-based editor, a portable JSON contract, and a controlled PostgreSQL bridge.

### 2.2 Value Proposition

| For | Who | The product | Unlike | Delivers |
|---|---|---|---|---|
| Database designers | model schemas visually | is a no-install, no-account web editor with portable JSON and PostgreSQL round-tripping | heavyweight diagramming suites and proprietary modelers | faster modeling, lossless exchange, and a safe path to a real schema |

### 2.3 Goals

| ID | Goal | Interview basis |
|---|---|---|
| G-1 | Provide a graphical canvas to create and edit database diagrams | "Graphic design" is a must-have |
| G-2 | Import and export database models in an agnostic format | Core problem statement |
| G-3 | Keep the diagramming and JSON experience fully client-side | "Application is web does not need to have a backend" |
| G-4 | Be publicly accessible with no authentication or roles | "Public application users", "No roles" |
| G-5 | Use open-source, lightweight web technologies | Explicit technical constraint |
| G-6 | Preserve model fidelity across export/import and database round-trips | "Agnostic way" implies lossless exchange |
| G-7 | Apply schema changes safely: preview DDL, require confirmation, never drop existing objects | Derived from the DB-connectivity requirement; see D-01 |

### 2.4 Non-Goals

- User accounts, authentication, authorization, or roles.
- Server-side persistence of diagrams or multi-user collaboration.
- Support for database engines other than PostgreSQL in v1 (MySQL, SQL Server, Oracle are deferred).
- Generating application code, ORM models, or migrations.
- Cloud hosting of the backend, telemetry, or user tracking.
- Enforcing every engine-specific rule during visual modeling (the model remains agnostic).

### 2.5 Success Metrics

Because the product targets local, low-volume use, success is measured on capability, fidelity, and safety rather than traffic growth.

| Metric | Target | Measurement |
|---|---|---|
| JSON round-trip fidelity | 100% of fixture diagrams re-import identically | Automated serialization tests |
| JSON validation coverage | 100% of schema rules, including negative cases | Unit tests against the JSON Schema |
| PostgreSQL introspection coverage | Tables, columns, types, PK, FK, unique constraints, indexes on PostgreSQL 14+ | Integration tests against a containerized PostgreSQL |
| DDL safety | 100% of exports require preview + explicit confirmation; 0 automatic drops | E2E tests + code review |
| Credential exposure | 0 credentials in JSON, logs, or persistent storage | Security audit + tests |
| Core-flow task success | ≥ 90% of usability participants create and export a 5-table diagram | Moderated usability test (n ≥ 5) |
| Accessibility | WCAG 2.1 AA on core flows | Audit (axe + manual keyboard pass) |
| Browser support | Latest two versions of Chrome, Firefox, Edge, Safari | Cross-browser test matrix |

> Targets are PM proposals derived from the interview's quality expectations and the safety requirements of live-database operations.

---

## 3. Scope

### 3.1 MVP Scope (v1.0)

| Area | Included |
|---|---|
| **Visual design** | Canvas with create, move, resize, delete; tables; columns with type, nullability, default, comment; primary keys; foreign keys; unique constraints; indexes |
| **JSON interchange** | Versioned export to `.json`; import with schema validation; atomic import (all-or-nothing) |
| **PostgreSQL** | Connect (host, port, database, user, password, schema); test connection; introspect an existing schema into a diagram; generate DDL from a diagram; preview SQL; explicit confirmation before execution; never drop existing objects |
| **Security** | Session-only credentials; no credentials in JSON, browser storage, or logs; untrusted-file handling |
| **Access** | Public application, no login, no roles |
| **Technology** | Open-source stack, lightweight web framework, static frontend, minimal local backend for PostgreSQL only |
| **Deployment** | Single `docker compose up` command starts frontend, backend, and a PostgreSQL 14+ instance with sample data; README documents the command and application URL |

### 3.2 Scope Decision Log

| ID | Decision | Rationale | Status |
|---|---|---|---|
| **D-01** | PostgreSQL connectivity is promoted from *nice-to-have* (interview) to **MVP (P0)** | The backlog and implementation target PostgreSQL as the first supported engine, turning the interview's "connection with known databases" into a concrete v1 capability | Adopted; confirmed by interview (must-have) |
| **D-02** | A **minimal local backend** is permitted, strictly for PostgreSQL communication | Browsers cannot open database sockets; the interview explicitly states the backend is allowed and required for PostgreSQL connectivity, while diagramming and JSON features remain client-side | Adopted; confirmed by interview |
| **D-03** | The interchange format is **canonical JSON**, not multi-dialect SQL | The interview specifies JSON as the save/load format ("save in JSON format and import them from the same format"); SQL DDL is generated only for the PostgreSQL target | Adopted |
| **D-04** | v1 supports **PostgreSQL 14+ only**; other engines are deferred | Keeps introspection and DDL generation testable and bounded; multi-engine support is a v1.1+ candidate | Adopted |
| **D-05** | Live-database operations are **explicitly confirmed, preview-first, and non-destructive** | Applying DDL to a real database is irreversible; safety outweighs convenience | Adopted |

### 3.3 Out of Scope (v1)

- Authentication, user profiles, sharing links, or cloud storage.
- Multi-user collaboration or real-time editing.
- Persistent server-side diagram storage.
- Database engines other than PostgreSQL 14+.
- Image/PDF export (candidate for v1.1+; Q-2).
- Mobile-first layout (desktop-first; tablet usable, phone not optimized).
- Analytics or user tracking.

### 3.4 Deferred / Phase 2+

| ID | Capability | Source | Note |
|---|---|---|---|
| N-1 | Support for MySQL, SQL Server, Oracle | Interview (nice-to-have) | Requires per-engine introspection and DDL dialects |
| N-2 | Diagram templates and sample schemas | Backlog | Low effort, high onboarding value |
| N-3 | Export to image (SVG/PNG) or PDF | Backlog | Presentation-oriented |
| N-4 | Installable PWA / offline mode | PM proposal | The app is already usable offline after load for JSON flows |

---

## 4. Personas and Access

### 4.1 Primary Persona — Database Designer

| Attribute | Detail |
|---|---|
| **Role** | Database designer / data modeler |
| **Goals** | Design and visualize schemas; exchange models via JSON or PostgreSQL; keep a single portable source of truth |
| **Technical level** | Comfortable with tables, columns, keys, constraints, indexes, cardinality, and normalization |
| **Pain points** | Tool lock-in, heavyweight tooling, no safe path from model to database |
| **Devices** | Desktop or laptop browser (≥ 1280×720) |
| **Access** | Public, anonymous, no account |

### 4.2 Secondary Personas

| Persona | Description |
|---|---|
| **Developer** | Imports a diagram or schema to understand structure before writing code |
| **Data analyst** | Visualizes an existing PostgreSQL schema to reason about relationships |
| **DBA** | Reviews generated DDL and confirms changes before execution |

### 4.3 Roles and Access

There are **no roles**. All functionality is available to every visitor. The application collects no personal data. Database credentials are supplied by the user per session and are never persisted.

---

## 5. Functional Requirements

Priorities: **P0** = must-have for v1, **P1** = should-have, **P2** = could-have / deferred. Requirement IDs are stable; the legacy feature IDs (F1–F8) are mapped in §5.6.

### 5.1 Visual Diagram Design

| ID | Requirement | Priority |
|---|---|---|
| FR-01 | The application shall render a canvas where tables can be placed, selected, moved, resized, and deleted. | P0 |
| FR-02 | The user shall be able to create a new empty diagram; creating one over unsaved work requires confirmation. | P0 |
| FR-03 | The user shall be able to add a table at a chosen position with a name and an editable list of columns. | P0 |
| FR-04 | Table names shall be non-empty, unique within the diagram, and limited to letters, digits, and underscores (starting with a letter or underscore). | P0 |
| FR-05 | The user shall be able to add, edit, reorder, and delete columns. A column shall carry: name, data type, length (where applicable), nullable flag, default value, and comment. | P0 |
| FR-06 | Column names shall be non-empty and unique within their table, using the same character rules as table names. | P0 |
| FR-07 | The user shall be able to mark one or more columns as primary key. | P0 |
| FR-08 | The user shall be able to create a foreign-key relationship by connecting a source column to a target column; table-level relationships shall also be representable. | P0 |
| FR-09 | A relationship shall record: source table/column, target table/column, and `ON DELETE` / `ON UPDATE` referential actions (`cascade`, `set null`, `set default`, `restrict`, `no action`). | P0 |
| FR-10 | Relationships shall render as connectors that update automatically when tables move or resize. | P0 |
| FR-11 | The user shall be able to define single-column and composite unique constraints. | P0 |
| FR-12 | The user shall be able to define single-column and composite indexes, including a uniqueness flag and an optional name. | P0 |
| FR-13 | The user shall be able to edit or delete any relationship, constraint, or index. | P0 |
| FR-14 | Deleting a table or column shall cascade to dependent relationships, constraints, and indexes **after** an explicit confirmation that names what will be removed. | P0 |
| FR-15 | The user should be able to undo and redo editing operations. | P1 |
| FR-16 | The user should be able to multi-select, align, and auto-arrange tables. | P1 |
| FR-17 | The user could collapse a table to show only its name and keys. | P2 |

### 5.2 JSON Interchange

| ID | Requirement | Priority |
|---|---|---|
| FR-18 | The user shall be able to export the full diagram as a single `.json` file, entirely client-side. | P0 |
| FR-19 | The exported document shall conform to the versioned canonical schema (`docs/api/diagram-json-schema.md`) and include `version` and `diagram` (with `id`, `name`, `tables`, `relationships`, `uniqueConstraints`, `indexes`, `createdAt`, `updatedAt`). | P0 |
| FR-20 | The user shall be able to import a JSON file via file picker and via drag-and-drop onto the canvas. | P0 |
| FR-21 | Import shall validate the file against the schema before mutating application state; import shall be atomic. | P0 |
| FR-22 | On validation failure, the application shall display an actionable error (what failed and where) and leave the current diagram unchanged. | P0 |
| FR-23 | Import shall reconstruct tables, columns, keys, constraints, indexes, relationships, and canvas positions. | P0 |
| FR-24 | Exporting then importing an unmodified file shall produce an identical diagram (round-trip fidelity). | P0 |
| FR-25 | The application shall reject unsupported major versions and state which versions are supported. | P0 |
| FR-26 | The JSON format shall be documented, machine-readable (JSON Schema Draft 7), and versioned with semantic versioning. | P0 |
| FR-27 | The application should tolerate unknown optional properties where the schema allows, without failing the import. | P1 |
| FR-28 | The application should reject files above a configurable size limit (default 10 MB) with a clear message. | P1 |
| FR-29 | The user could copy the JSON to the clipboard in addition to downloading it. | P2 |

### 5.3 PostgreSQL Integration

| ID | Requirement | Priority |
|---|---|---|
| FR-30 | The user shall be able to enter connection parameters: host, port, database, user, password, and target schema. | P0 |
| FR-31 | The application shall test the connection through the backend and report success or a descriptive failure. | P0 |
| FR-32 | The user shall be able to import an existing PostgreSQL schema (PostgreSQL 14+) as a diagram, including tables, columns, data types, primary keys, foreign keys, unique constraints, and indexes. | P0 |
| FR-33 | The imported schema shall render as an editable diagram, preserving names, types, keys, and relationships. | P0 |
| FR-34 | The user shall be able to generate DDL (`CREATE TABLE`, keys, relationships, constraints, indexes) for a chosen target schema from the current diagram. | P0 |
| FR-35 | The generated SQL shall be displayed for review before anything is executed. | P0 |
| FR-36 | DDL execution shall require explicit user confirmation; cancellation shall leave the database untouched. | P0 |
| FR-37 | The application shall never drop or alter existing database objects; conflicts shall be reported to the user instead. | P0 |
| FR-38 | On DDL failure, the backend shall return a descriptive error and report which statements succeeded. | P0 |
| FR-39 | The backend shall expose a minimal API: test connection, read schema, apply schema. | P0 |
| FR-40 | Connection failures (DNS, authentication, timeout, permissions, unsupported version) shall map to distinct, user-readable messages. | P0 |
| FR-41 | The user should be able to choose which schemas are introspected when a database contains several. | P1 |
| FR-42 | The user could save connection profiles **without** passwords (host/port/database/user only). | P2 |

### 5.4 Security and Credentials

| ID | Requirement | Priority |
|---|---|---|
| FR-43 | Database credentials shall be held only for the current session and cleared on refresh, tab close, or explicit disconnect. | P0 |
| FR-44 | Credentials shall never be written to JSON, `localStorage`, `sessionStorage`, cookies, logs, or error messages. | P0 |
| FR-45 | The JSON serializer shall include a guard that rejects any document containing credential fields (host, port, database, user, password). | P0 |
| FR-46 | The backend shall not log connection strings or passwords. | P0 |
| FR-47 | Imported files shall be treated as untrusted: parse defensively, never `eval`, and sanitize any rendered text. | P0 |
| FR-48 | The backend shall bind to localhost by default and require an explicit opt-in to expose itself on a network interface. | P0 |
| FR-49 | The backend should enforce request-size and connection-time limits to prevent resource exhaustion. | P1 |

### 5.5 Diagram Lifecycle and UX

| ID | Requirement | Priority |
|---|---|---|
| FR-50 | The application shall track unsaved changes and warn before discarding them (new diagram, import, navigation). | P0 |
| FR-51 | The application should restore the most recent diagram from `localStorage` on reload and inform the user that it was restored. | P1 |
| FR-52 | The application should display the diagram name and last-modified time. | P1 |
| FR-53 | Core actions shall be reachable from a visible toolbar and via keyboard shortcuts. | P1 |
| FR-54 | Destructive actions shall require confirmation or offer undo. | P0 |
| FR-55 | Validation errors shall identify the offending field or file location and suggest a fix. | P0 |
| FR-56 | Empty states shall explain the next action. | P1 |
| FR-57 | All interactive controls shall be keyboard reachable with visible focus. | P1 |
| FR-58 | UI strings shall be externalized to allow future localization (English only in v1). | P2 |

### 5.6 Feature Crosswalk (legacy F-IDs)

| Legacy ID | Feature | Requirements |
|---|---|---|
| F1 | Graphic design interface | FR-01 – FR-17 |
| F2 | Export diagram to JSON | FR-18, FR-19, FR-24, FR-26 |
| F3 | Import diagram from JSON | FR-20 – FR-25, FR-27, FR-28 |
| F4 | Connect to PostgreSQL | FR-30, FR-31, FR-39, FR-40 |
| F5 | Import PostgreSQL schema as a diagram | FR-32, FR-33, FR-41 |
| F6 | Export diagram to PostgreSQL with DDL preview and confirmation | FR-34 – FR-38 |
| F7 | Session-only credentials | FR-43 – FR-46, FR-48, FR-49 |
| F8 | Other database engines (nice-to-have) | N-1 (deferred) |

---

## 6. Canonical JSON Contract

The JSON document is the product's interchange contract and therefore a first-class requirement. The authoritative, machine-readable definition lives in `src/schema/diagram.schema.json` and is documented in `docs/api/diagram-json-schema.md`.

### 6.1 Envelope

```json
{
  "version": "1.0.0",
  "diagram": {
    "id": "3f1c2a9e-...",
    "name": "Sales Model",
    "tables": [],
    "relationships": [],
    "uniqueConstraints": [],
    "indexes": [],
    "createdAt": "2026-10-20T10:00:00Z",
    "updatedAt": "2026-10-20T12:30:00Z"
  }
}
```

### 6.2 Core Entities

| Entity | Key fields |
|---|---|
| **Table** | `id` (uuid), `name`, `x`, `y`, `width`, `height`, `columns[]` |
| **Column** | `id`, `name`, `type` (agnostic string, e.g. `serial`, `varchar`, `numeric`), `length`, `nullable`, `primaryKey`, `unique`, `defaultValue`, `comment` |
| **Relationship** | `id`, `sourceTableId`, `sourceColumnId`, `targetTableId`, `targetColumnId`, `onDelete`, `onUpdate` |
| **UniqueConstraint** | `id`, `tableId`, `columnIds[]`, `name` |
| **Index** | `id`, `tableId`, `columnIds[]`, `unique`, `name` |

### 6.3 Contract Rules

| ID | Rule |
|---|---|
| JSON-01 | Identifiers are UUIDs and must be unique within their collection; they remain stable across save/load. |
| JSON-02 | `type` is a free-form, engine-agnostic string to avoid dialect lock-in; PostgreSQL-specific normalization happens at DDL generation. |
| JSON-03 | Required fields are always present; optional fields may be omitted and receive documented defaults. |
| JSON-04 | The schema uses `additionalProperties: false`; unknown properties cause validation failure unless a future minor version explicitly allows them. |
| JSON-05 | Semantic versioning: breaking changes require a major bump and a migration note; compatible additions require a minor bump. |
| JSON-06 | No credential fields may appear anywhere in the document (FR-45). |
| JSON-07 | Timestamps are ISO 8601 UTC. |
| JSON-08 | Name fields follow the identifier rules in FR-04 and FR-06. |

---

## 7. User Stories and Acceptance Criteria

Story points use the Fibonacci scale. Stories map to backlog epics **E1–E4**.

### Epic E1 — Visual Diagram Design

#### US-1.1 Create a diagram
**As a** database designer **I want** a blank canvas **so that** I can start modeling.
**Priority:** P0 · **Points:** 3
- **Given** the application is open, **when** I create a new diagram, **then** an empty canvas appears ready for tables.
- **Given** unsaved work exists, **when** I create a new diagram, **then** I am asked to confirm before losing it.

#### US-1.2 Add and arrange tables
**As a** database designer **I want** to add, move, resize, and delete tables **so that** I can model entities and organize the diagram.
**Priority:** P0 · **Points:** 5
- **Given** a canvas, **when** I add a table, **then** it appears at the chosen position with a default name and an empty column list.
- **Given** two tables with the same name, **when** I confirm the second, **then** the duplicate is rejected with an explanation.
- **Given** a table with relationships, **when** I move it, **then** connectors follow and layout is preserved on export.

#### US-1.3 Edit columns
**As a** database designer **I want** to add, edit, reorder, and remove columns **so that** the schema structure is accurate.
**Priority:** P0 · **Points:** 5
- **Given** a table, **when** I edit name, type, nullability, default, or comment, **then** the table reflects the change immediately.
- **Given** two columns with the same name in one table, **when** I confirm, **then** the duplicate is blocked with a clear message.

#### US-1.4 Define primary keys
**As a** database designer **I want** to mark columns as primary key **so that** entity integrity is modeled.
**Priority:** P0 · **Points:** 2
- **Given** a table, **when** I mark a column as primary key, **then** it is visually indicated and exported.
- **Given** a composite key, **when** I mark multiple columns, **then** all are included in the key.

#### US-1.5 Define foreign-key relationships
**As a** database designer **I want** to connect columns across tables **so that** referential integrity is modeled.
**Priority:** P0 · **Points:** 5
- **Given** two tables, **when** I connect a source column to a target column, **then** a relationship is created with the chosen referential actions.
- **Given** a relationship, **when** I delete it, **then** it is removed from the canvas and the export.
- **Given** a self-referencing table, **when** I create a relationship, **then** it renders correctly.

#### US-1.6 Define unique constraints
**As a** database designer **I want** single or composite unique constraints **so that** uniqueness rules are captured.
**Priority:** P0 · **Points:** 3
- **Given** a table, **when** I add a unique constraint over one or more columns, **then** it is recorded, named if provided, and exported.

#### US-1.7 Define indexes
**As a** database designer **I want** single or composite indexes with a uniqueness flag **so that** performance design is documented.
**Priority:** P0 · **Points:** 3
- **Given** a table, **when** I add an index, **then** it is recorded with its columns, uniqueness, and optional name, and is exported.

#### US-1.8 Edit diagram elements
**As a** database designer **I want** to delete or modify any element **so that** I can keep the model correct.
**Priority:** P0 · **Points:** 3
- **Given** an element with dependents, **when** I delete it, **then** the impact is explained and confirmation is required.
- **Given** a confirmed deletion, **then** dependent relationships/constraints/indexes are removed consistently.

### Epic E2 — JSON Interchange

#### US-2.1 Export to JSON
**As a** database designer **I want** to save my diagram as JSON **so that** I can back it up, version it, or share it.
**Priority:** P0 · **Points:** 3
- **Given** a diagram, **when** I export, **then** a valid `.json` file downloads containing all model data and layout.
- **Given** the exported file, **then** it contains no credentials.

#### US-2.2 Import from JSON
**As a** database designer **I want** to load a JSON file **so that** I can continue working on an existing model.
**Priority:** P0 · **Points:** 5
- **Given** a valid file, **when** I import it, **then** the diagram is reconstructed exactly and becomes editable.
- **Given** an invalid or unsupported file, **when** I import it, **then** an actionable error appears and my current diagram is unchanged.
- **Given** unsaved changes, **when** I start an import, **then** I confirm before replacement.

#### US-2.3 Round-trip fidelity
**As a** user **I want** my exported model to re-import unchanged **so that** the format is trustworthy.
**Priority:** P0 · **Points:** 3
- **Given** any schema-valid fixture, **when** exported and re-imported, **then** the resulting diagram is identical in structure and layout.

#### US-2.4 No credentials in JSON
**As a** security-conscious user **I want** credentials excluded from files **so that** sharing a diagram cannot leak access.
**Priority:** P0 · **Points:** 2
- **Given** an export, **when** the file is inspected, **then** no host, port, database, user, or password fields are present.
- **Given** a tampered input containing credential fields, **when** imported, **then** it is rejected.

### Epic E3 — PostgreSQL Integration

#### US-3.1 Connect to PostgreSQL
**As a** database designer **I want** to connect with host, port, database, user, password, and schema **so that** I can work with a live database.
**Priority:** P0 · **Points:** 5
- **Given** valid parameters, **when** I test the connection, **then** success is reported.
- **Given** invalid parameters, **when** I test, **then** a specific, actionable error is shown (auth, DNS, timeout, permissions, version).
- **Given** a session, **then** credentials exist only in memory.

#### US-3.2 Import a PostgreSQL schema
**As a** database designer **I want** to introspect an existing schema **so that** I can visualize and edit it.
**Priority:** P0 · **Points:** 8
- **Given** an active connection, **when** I import a schema, **then** tables, columns, types, PK, FK, unique constraints, and indexes are retrieved.
- **Given** a schema with multiple namespaces, **when** I choose a schema, **then** only that schema is imported (P1).

#### US-3.3 Export a diagram to PostgreSQL
**As a** database designer **I want** to generate and apply DDL **so that** my model becomes a real schema.
**Priority:** P0 · **Points:** 8
- **Given** a diagram and connection, **when** I choose export, **then** DDL is generated for the chosen schema and displayed.
- **Given** the preview, **when** I confirm, **then** the DDL is executed.
- **Given** the preview, **when** I cancel, **then** nothing is executed.
- **Given** an object already exists, **then** it is never dropped or altered; the conflict is reported.

#### US-3.4 Session-only credentials
**As a** security-conscious user **I want** credentials cleared when the session ends **so that** nothing sensitive persists.
**Priority:** P0 · **Points:** 2
- **Given** an active connection, **when** the page refreshes or the tab closes, **then** credentials are cleared from memory and storage.
- **Given** a disconnect action, **then** credentials are cleared immediately.

### Epic E4 — Backend API (PostgreSQL Only)

#### US-4.1 Test connection
**As a** user **I want** the backend to validate my connection **so that** I know immediately whether it works.
**Priority:** P0 · **Points:** 3
- **Given** parameters, **when** the frontend calls `POST /api/v1/connections/test`, **then** the backend attempts a PostgreSQL 14+ connection and returns success or a descriptive error.

#### US-4.2 Read schema
**As a** user **I want** the backend to introspect PostgreSQL **so that** the frontend can render it.
**Priority:** P0 · **Points:** 5
- **Given** an active connection, **when** the frontend calls `POST /api/read-schema`, **then** structured metadata is returned for the chosen schema.

#### US-4.3 Apply schema
**As a** user **I want** the backend to execute confirmed DDL **so that** the diagram is realized.
**Priority:** P0 · **Points:** 5
- **Given** validated DDL and confirmation, **when** the frontend calls `POST /api/apply-schema`, **then** the DDL is executed and success or a descriptive error is returned.
- **Given** failure mid-batch, **then** the response identifies which statements succeeded and which failed.

---

## 8. UX Requirements and Key Flows

### 8.1 Key Flows

1. **First use:** open app → empty canvas with guidance → add table → edit columns → add relationship → export JSON.
2. **Resume work:** open app → autosaved diagram restored with a notice → continue editing.
3. **Transport:** export → share file → recipient imports → identical diagram.
4. **Database in:** connect → test → choose schema → import → edit.
5. **Database out:** connect → generate DDL → review preview → confirm → apply → success/error report.
6. **Recovery:** invalid import → actionable error → existing diagram intact.

### 8.2 UX Requirements

| ID | Requirement |
|---|---|
| UX-01 | Core actions are reachable from a visible toolbar and via keyboard shortcuts (FR-53). |
| UX-02 | Destructive actions require confirmation or offer undo (FR-54). |
| UX-03 | Errors identify the offending field or file location and suggest a fix (FR-55). |
| UX-04 | The interface is usable at 1280×720 and above without horizontal scrolling of the app chrome. |
| UX-05 | Empty states explain the next action (FR-56). |
| UX-06 | All interactive controls are keyboard reachable with visible focus (FR-57). |
| UX-07 | The UI language is English; strings are externalized for future localization (FR-58). |
| UX-08 | Database operations show progress and are cancellable client-side; the UI must never imply success before the backend confirms it. |

---

## 9. Non-Functional Requirements

| Category | Requirement |
|---|---|
| **Architecture** | Static single-page frontend; a minimal local backend exists solely for PostgreSQL connectivity. All diagramming and JSON processing are client-side. |
| **Technology** | Open-source only, permissive licenses (MIT / Apache-2.0 / BSD). Lightweight web framework. No proprietary services. |
| **Performance** | Drag/zoom feedback ≤ 100 ms with 50 tables; JSON import ≤ 1 s for a 50-table file on a mid-range laptop; schema introspection ≤ 10 s for 100 tables; DDL generation ≤ 2 s for 100 tables. |
| **Capacity** | Diagrams up to ~100 tables and ~1,500 columns without noticeable degradation; import file limit 10 MB (FR-28). |
| **Scalability** | Single local user; no horizontal scaling required. Backend must handle one concurrent request per session without leaking connections. |
| **Compatibility** | PostgreSQL 14+; latest two versions of Chrome, Firefox, Edge, Safari. |
| **Accessibility** | WCAG 2.1 AA for core flows, including keyboard operation of the canvas where feasible. |
| **Security** | Credentials session-only and never persisted (FR-43 – FR-49); imported files untrusted; no `eval`; text sanitized; backend bound to localhost by default. |
| **Privacy** | No personal data collection, no telemetry, no third-party analytics. |
| **Reliability** | Import is atomic; no data loss on validation failure; DDL failures are reported with statement-level detail. |
| **Offline** | Diagramming and JSON flows work without network after initial load. |
| **Maintainability** | Documented, versioned JSON contract; schema validation covered by automated tests; backend limited to three endpoints. |
| **Documentation** | README documents the `docker compose up` command and the URL where the application is available; API and user documentation are maintained in `docs/`. |
| **Portability** | Static frontend deployable to any static host; backend packaged as a lightweight container or local process. |
| **Observability** | Structured backend errors without secrets; no credential material in logs. |

---

## 10. Data Validation Rules

| ID | Rule |
|---|---|
| DR-01 | Table names are non-empty, unique per diagram, and match `^[A-Za-z_][A-Za-z0-9_]*$`. |
| DR-02 | Column names are non-empty, unique per table, and match the same pattern. |
| DR-03 | Every table should have at least one primary key column; absence is a warning, not a hard error, to allow draft modeling. |
| DR-04 | Every relationship's source and target must reference existing tables; column references must exist when specified. |
| DR-05 | Deleting a referenced table or column cascades to dependent relationships, constraints, and indexes after confirmation. |
| DR-06 | Table, column, relationship, constraint, and index identifiers are unique UUIDs and stable across saves. |
| DR-07 | Layout values (`x`, `y`, `width`, `height`) are finite numbers within allowed ranges; invalid values fail validation. |
| DR-08 | Referential actions are restricted to the documented enum. |
| DR-09 | A unique constraint or index references at least one existing column. |
| DR-10 | Credential fields are rejected anywhere in an imported document. |

---

## 11. Roadmap and Release Plan

No external deadline or budget constraint was stated in the interview. Milestones are sequenced by dependency.

### Phase 1 — v1.0 (MVP)

| Milestone | Scope | Requirements | Target |
|---|---|---|---|
| M1 | Diagram canvas: create diagram, add/edit/delete tables and columns, primary keys | FR-01 – FR-07 | Month 1 |
| M2 | Relationships, unique constraints, indexes | FR-08 – FR-14 | Month 1 |
| M3 | JSON export, import, validation, versioning, round-trip fidelity | FR-18 – FR-28 | Month 1 |
| M4 | Minimal backend: test connection, read schema, apply schema | FR-30, FR-31, FR-39, FR-40 | Month 2 |
| M5 | PostgreSQL schema import as a diagram | FR-32, FR-33, FR-41 | Month 2 |
| M6 | PostgreSQL export with DDL preview and confirmation | FR-34 – FR-38 | Month 2 |
| M7 | Session-only credentials, security hardening, credential audit | FR-43 – FR-49 | Month 2 |
| M8 | Hardening: unsaved-changes guard, autosave, accessibility, cross-browser QA | FR-50 – FR-57 | Month 2 |

**v1.0 exit criteria:** a user can model a multi-table schema, round-trip it through JSON with 100% fidelity, introspect a PostgreSQL schema, generate DDL, review it, and apply it only after explicit confirmation — with no credential persistence and no automatic drops.

### Phase 2 — v1.1+ (Deferred)

| Milestone | Scope | Target |
|---|---|---|
| M9 | Additional database engines (MySQL, SQL Server, Oracle) | TBD |
| M10 | Diagram templates and presets | TBD |
| M11 | Image/PDF export | TBD |
| M12 | Optional PWA / offline install | TBD |

---

## 12. Dependencies, Assumptions, Risks

### 12.1 Assumptions

| ID | Assumption |
|---|---|
| A-1 | "Agnostic" means a canonical, engine-neutral JSON document (D-03), not multi-dialect SQL. |
| A-2 | Users have a modern evergreen browser and work on desktop or tablet. |
| A-3 | File transfer (email, Git, shared drive) is an acceptable sharing mechanism; no cloud storage is needed. |
| A-4 | No authentication is acceptable because no server-side diagram data exists. |
| A-5 | The stakeholder accepts a minimal local backend as the only way to reach PostgreSQL from a browser (D-02). |
| A-6 | Target databases are PostgreSQL 14+ and reachable from the machine running the backend. |

### 12.2 Dependencies

| ID | Dependency |
|---|---|
| DEP-1 | Selection of a lightweight open-source frontend framework and diagramming/rendering library, with license review. |
| DEP-2 | A JSON Schema Draft 7 validator compatible with the chosen stack. |
| DEP-3 | A maintained PostgreSQL driver and a documented introspection strategy (`database/introspection.sql`). |
| DEP-4 | UI design for canvas interactions (selection, connectors, inline editing). |
| DEP-5 | Containerized PostgreSQL for integration and E2E testing. |

### 12.3 Risks

| ID | Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|---|
| R-1 | Live DB connectivity requires a minimal local backend (interview-validated) | High | Certain | Documented as D-02; keep the backend minimal and localhost-only |
| R-2 | Canvas interaction complexity (connectors, zoom, selection) inflates effort | Medium | High | Use a proven open-source graph library; prototype early |
| R-3 | Round-trip fidelity breaks on edge cases (self-references, composite keys, unknown fields) | High | Medium | Schema-first design; fixture-based tests; strict validation with documented defaults |
| R-4 | DDL execution damages a target database | High | Low | Preview + explicit confirmation; never drop; statement-level error reporting |
| R-5 | Credential leakage via logs, storage, or exports | High | Low | Session-only memory; serializer guard; security audit and tests |
| R-6 | Introspection misses PostgreSQL objects (generated columns, partitions, domains, enums) | Medium | Medium | Scope v1 explicitly; log unsupported constructs; extend iteratively |
| R-7 | Large diagrams degrade performance | Medium | Low | Capacity target (100 tables); virtualization if needed |
| R-8 | Accessibility of a drag-and-drop canvas | Medium | Medium | Provide keyboard alternatives; audit early |
| R-9 | Users lose work because there is no server persistence | High | Medium | Autosave + unsaved-changes guard + prominent export |
| R-10 | Scope creep toward a full data-modeling suite | Medium | Medium | Enforce MVP boundary; backlog new requests |

---

## 13. Open Questions

| ID | Question | Owner | Needed by | Status |
|---|---|---|---|---|
| Q-1 | Does the stakeholder confirm PostgreSQL as a v1 must-have and the minimal backend exception? | Customer / PM | Before v1 sign-off | Resolved — confirmed by the October 20, 2026 interview |
| Q-2 | Are image/PDF exports required, or is JSON + PostgreSQL sufficient? | Customer | Before M11 | Open |
| Q-3 | Should templates/sample diagrams ship with v1? | Customer | Before M1 | Open |
| Q-4 | Which PostgreSQL objects beyond tables/columns/keys/constraints/indexes must be supported (enums, domains, partitions, views, sequences)? | Architect / DBA | Before M5 | Open |
| Q-5 | Is `localStorage` autosave of diagrams acceptable, given credentials must never be stored there? | Customer / Security | Before M8 | Open |
| Q-6 | Should composite foreign keys be supported in v1, or only single-column FKs? | Architect | Before M2 | Open |
| Q-7 | What is the exact JSON schema for diagram serialization? | Architect | Before M3 | **Resolved** — `docs/api/diagram-json-schema.md` (v1.0.0) |
| Q-8 | Which lightweight web framework and diagramming library will be used? | Architect | Before M1 | Open |

---

## 14. Traceability: Interview → Requirements

| Interview statement | Requirement(s) |
|---|---|
| "design database diagrams" | G-1, FR-01 – FR-17 |
| "import and export database models in an agnostic way" | G-2, G-6, FR-18 – FR-28, §6 |
| "create and edit database diagrams" | FR-02 – FR-14 |
| "save in JSON format and import them from the same format" | FR-18 – FR-26, §6 |
| "Graphic design" (must-have) | FR-01 – FR-17 |
| "public application users / no roles" | G-4, §4.3, FR-43 – FR-49 |
| "does not need to have a backend" | G-3, NFR Architecture (JSON flows client-side), D-02 (backend required only for PostgreSQL) |
| "open-source technologies / light web framework" | G-5, DEP-1, NFR Technology |
| "local use, no performance problem" | §2.5, NFR Performance/Capacity |
| "connection with known databases to create empty schemas" (nice-to-have) | D-01, FR-30 – FR-42 |
| "import from existent database" (nice-to-have) | FR-32, FR-33 |
| "No timeline / no budget" | §11 (dependency-sequenced) |

---

## 15. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Product Manager | Product Manager Agent | — | November 6, 2026 |
| Stakeholder | database-designer | — | — |
| Database Expert | TBD | — | — |

### Next Steps

1. Scope decisions D-01 and D-02 are confirmed by the interview; proceed with implementation.
2. Resolve open questions Q-2 through Q-6 and Q-8.
3. Refine the backlog into sprint-sized stories and tasks against this PRD.
4. Validate the JSON contract and PostgreSQL introspection scope with the database expert.
5. Plan the v1.0 release readiness review against the exit criteria in §11.

---

## 16. Glossary

| Term | Definition |
|---|---|
| **Agnostic format** | An engine-neutral representation not tied to a specific database vendor or SQL dialect. |
| **Atomic import** | Import either fully succeeds or leaves the existing diagram untouched. |
| **Canonical JSON** | The versioned JSON document defined in §6, the product's interchange contract. |
| **Cardinality** | The numeric relationship between rows of two tables (1:1, 1:N, N:M). |
| **DDL** | Data Definition Language — SQL statements that create or modify schema objects. |
| **Introspection** | Reading an existing database's catalog to derive tables, columns, keys, constraints, and indexes. |
| **Round-trip fidelity** | Exporting and re-importing a diagram yields an identical model. |
| **Session-only credentials** | Connection secrets held in memory for the current session and never persisted. |

---

*End of document — PRD v3.0, November 6, 2026.*
