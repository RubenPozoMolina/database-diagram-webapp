# User Guide — Database Diagram Web Application

This guide explains how to use the Database Diagram Web Application to create, edit, import, export, and synchronize database diagrams. It covers visual diagramming, JSON import/export, and PostgreSQL integration.

## Overview

The Database Diagram Web Application is a browser-based tool for designing database schemas visually. It supports:

- **Visual diagramming** — create tables, columns, keys, constraints, indexes, and relationships on a canvas
- **JSON import/export** — save diagrams as JSON files and import them back
- **PostgreSQL integration** — connect to a live PostgreSQL database, import its schema as a diagram, and export a diagram as DDL

The application requires no authentication and stores no data on a server. Database credentials are held only in memory for the current session and are never written to disk or embedded in exported JSON files.

---

## 1. Creating a Diagram

### 1.1 Starting a New Diagram

When you open the application, an empty canvas is displayed. To begin designing:

1. Open the application in your browser.
2. The canvas is ready — no tables or relationships are present initially.
3. Add tables using the **Add Table** button or menu action.

### 1.2 Adding a Table

1. Click **Add Table** to open the table creation modal.
2. Enter a table name (alphanumeric + underscore, starting with a letter or underscore).
3. Add one or more columns:
   - **Name** — column name
   - **Type** — SQL data type (`integer`, `varchar`, `text`, `boolean`, `date`, `timestamp`, `decimal`, etc.)
   - **Nullable** — whether NULL values are allowed
   - **Primary Key** — mark the column as part of the primary key
   - **Default Value** — optional SQL default expression
   - **Comment** — optional description
   - **Length** — max length for character types (e.g. `varchar(255)`)
   - **Unique** — single-column unique constraint shortcut
4. Add unique constraints if needed (supports composite constraints across multiple columns).
5. Click **Create Table** to add it to the canvas.

### 1.3 Editing Tables and Columns

- Click a table on the canvas to select it.
- Drag a table to reposition it.
- Use the edit controls to modify column names, types, nullability, defaults, and primary key flags.
- Delete a table by selecting it and using the delete action.

### 1.4 Defining Primary Keys

Mark one or more columns as primary keys within a table. Composite primary keys (multiple columns) are supported.

### 1.5 Creating Relationships (Foreign Keys)

1. Click **Add Relationship** to open the relationship modal.
2. Select a **source table** and **source column** (the table containing the foreign key).
3. Select a **target table** and **target column** (the referenced primary key column).
4. Source and target tables must be different.
5. Click **Create Relationship** to draw a connector line between the tables.

Relationships support:
- Single-column and composite foreign keys
- Self-referencing relationships (a table related to itself)
- Circular dependencies between tables

### 1.6 Adding Unique Constraints and Indexes

- **Unique constraints** — enforce uniqueness on one or more columns of a table. Composite unique constraints are supported.
- **Indexes** — mark columns for indexing, with an option for unique indexes. Constraint-backed indexes are tracked so they can be filtered from the UI if desired.

### 1.7 Moving, Resizing, and Deleting Elements

- Drag tables to reposition them on the canvas.
- Resize tables by dragging their edges.
- Delete tables and relationships using the delete controls.
- The diagram model updates automatically as you make changes.

---

## 2. JSON Import/Export

### 2.1 Exporting a Diagram to JSON

1. Design your diagram on the canvas (tables, columns, keys, relationships, constraints, indexes).
2. Click **Export to JSON**.
3. A JSON file is downloaded containing the complete diagram model.
4. The default filename is derived from the diagram name (e.g. `my_diagram.json`).

**The exported JSON contains no database credentials.** Host, port, database, user, and password fields are never included, per the application's security policy.

### 2.2 Importing a Diagram from JSON

1. Click **Import from JSON**.
2. Select a `.json` file containing a previously exported diagram.
3. If the file is valid and contains a supported diagram model, the diagram is loaded onto the canvas and becomes editable.
4. If the file is invalid, not valid JSON, or contains an unsupported structure, an error message is displayed.

### 2.3 JSON Format

Exported JSON follows a versioned envelope format:

```json
{
  "version": "1.0.0",
  "diagram": {
    "id": "<uuid>",
    "name": "My Diagram",
    "tables": [...],
    "relationships": [...],
    "uniqueConstraints": [...],
    "indexes": [...],
    "createdAt": "2026-11-04T...",
    "updatedAt": "2026-11-04T..."
  }
}
```

For the complete schema definition, see [`docs/api/diagram-json-schema.md`](./api/diagram-json-schema.md) and [`src/schema/diagram.schema.json`](../../src/schema/diagram.schema.json).

### 2.4 Round-Trip Integrity

Exporting a diagram to JSON and re-importing it preserves all data without loss — tables, columns, types, keys, constraints, indexes, and relationships are all restored.

---

## 3. PostgreSQL Integration

The application connects to a PostgreSQL database through a lightweight local backend. The browser cannot open direct database connections, so all PostgreSQL communication goes through the backend API.

### 3.1 Connecting to PostgreSQL

1. Click **Connect** (or the connection control) to open the connection form.
2. Provide the following:
   - **Host** — PostgreSQL server hostname or IP address
   - **Port** — PostgreSQL port (default: `5432`)
   - **Database** — target database name
   - **User** — database user
   - **Password** — database password
3. Click **Test Connection** to verify the credentials before proceeding.
4. If the connection succeeds, the status changes to **Connected** and you can proceed with schema import or export.

**Session-only credentials:** Your credentials are held in memory only for the current browser session. They are never written to `localStorage`, `sessionStorage`, cookies, or disk. When you refresh or close the page, credentials are cleared and you must reconnect.

### 3.2 Importing a PostgreSQL Schema

1. Ensure you are connected to PostgreSQL.
2. Click **Import Schema** (or the schema import action).
3. The backend introspects the database and returns:
   - Tables and columns (with data types, nullability, defaults, lengths)
   - Primary keys (including composite keys)
   - Foreign keys (including self-references and circular dependencies)
   - Unique constraints
   - Indexes (with uniqueness and constraint flags)
4. The schema is rendered as an editable diagram on the canvas.
5. System schemas (`pg_catalog`, `information_schema`) are excluded by default.

The import is **read-only** — no changes are made to your database.

### 3.3 Exporting a Diagram to PostgreSQL

1. Design or import a diagram on the canvas.
2. Ensure you are connected to PostgreSQL.
3. Click **Export to PostgreSQL** (or the schema export action).
4. The application generates DDL (`CREATE TABLE`, keys, constraints, indexes) for your diagram.
5. The generated SQL is displayed in a **DDL Preview** modal for your review.
6. Review the DDL carefully. The application enforces a **no-drops** policy — `DROP`, `TRUNCATE`, and object-altering `ALTER` statements are rejected.
7. Check the confirmation checkbox: **"I confirm I want to execute this DDL on the database"**.
8. Click **Execute DDL**. The DDL is sent to the backend and executed within a transaction.
9. You receive a success or error message.

**Safety guarantees:**
- DDL is only executed when you explicitly confirm after viewing the preview.
- Existing database objects are never dropped or altered by the application.
- DDL runs in a transaction; if a statement fails, changes are rolled back where supported.
- Your password is never logged or returned in error messages.

### 3.4 Disconnecting

Click **Disconnect** to clear credentials from memory. Credentials are also automatically cleared when you refresh or close the page.

---

## 4. Security Summary

| Practice | How it's enforced |
|---|---|
| No credential persistence | Credentials live in React component state only; never written to browser storage or disk |
| Session-only scope | `beforeunload` and `pagehide` listeners clear credentials on page close/refresh |
| No credentials in JSON | The JSON serializer rejects any diagram data containing `host`, `port`, `database`, `user`, `password`, or similar fields |
| No accidental data loss | DDL preview + explicit confirmation required; no-drops constraint enforced at API level |
| No authentication required | Application is publicly accessible; no user roles or login |

---

## 5. Backend API Reference

The application uses a lightweight Node.js + Express backend for PostgreSQL communication. Three endpoints are available:

| Endpoint | Method | Purpose |
|---|---|---|
| `POST /api/v1/connections/test` | Test PostgreSQL connection credentials |
| `POST /api/read-schema` | Introspect a PostgreSQL schema |
| `POST /api/apply-schema` | Apply DDL to a PostgreSQL schema (requires confirmation) |
| `GET /health` | Health check |

For complete endpoint specifications (request format, response format, error handling, security considerations), see:

- [`docs/api/test-connection.md`](./api/test-connection.md)
- [`docs/api/read-schema.md`](./api/read-schema.md)
- [`docs/api/apply-schema.md`](./api/apply-schema.md)
- [`docs/api/diagram-json-schema.md`](./api/diagram-json-schema.md)

---

## 6. Troubleshooting

| Issue | Possible Cause | Solution |
|---|---|---|
| Connection test fails | Wrong host, port, database, user, or password | Verify credentials and ensure PostgreSQL is reachable |
| Connection timeout | Server unreachable or firewall blocking | Check network connectivity; increase timeout if needed |
| Schema import returns no tables | Wrong schema selected or empty database | Verify the schema name (default: `public`) |
| DDL execution rejected | DDL contains `DROP`, `TRUNCATE`, or altering `ALTER` | Remove destructive statements; only `CREATE` is allowed |
| Import JSON fails with error | File is invalid JSON or unsupported schema version | Use a file exported by this application (version 1.0.0) |
| Exported JSON missing data | Diagram not fully defined | Ensure all tables, columns, and relationships are configured |

---

## 7. Keeping Documentation Current

This documentation is maintained alongside the codebase. When features change:

- Update `README.md` for project-level changes (setup, architecture, commands)
- Update `docs/api/*.md` for API endpoint changes
- Update `docs/user-guide.md` for UI or workflow changes
- Update `docs/api/diagram-json-schema.md` for JSON format changes

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) (if present) or contact the product team for documentation contribution guidelines.