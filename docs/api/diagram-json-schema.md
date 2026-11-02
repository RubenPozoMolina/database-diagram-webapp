# Database Diagram JSON Schema

## Overview

This document defines the JSON schema for serializing and deserializing database diagram models in the Database Diagram Web Application. The schema is versioned and serves as the contract between the frontend serializer, the backend API, and any external tools that import or export diagram files.

## Schema Location

- **Schema file**: `src/schema/diagram.schema.json`
- **Example file**: `src/schema/diagram.example.json`
- **JSON Schema Draft**: Draft 7
- **Schema ID**: `https://rubenpoziomolina.github.io/database-diagram-webapp/schema/diagram.schema.json`

## Versioning

| Schema Version | Serializer Version | Status | Description |
|---|---|---|---|
| 1.0.0 | 1.0.0 | Current | Initial schema defining tables, columns, data types, primary keys, foreign keys, unique constraints, indexes, and relationships. |

The schema version follows [semantic versioning](https://semver.org/). Breaking changes to the structure will increment the major version. Backward-compatible additions will increment the minor version. Editorial fixes will increment the patch version.

The `version` field in the serialized JSON must match `DIAGRAM_JSON_VERSION` in the serializer (`frontend/src/services/diagram-serializer.ts`).

## Structure

### Root Envelope (`DiagramJSON`)

The serialized JSON is wrapped in a versioned envelope:

| Field | Type | Required | Description |
|---|---|---|---|
| `version` | string | Yes | Schema version (semver pattern) |
| `diagram` | [Diagram](#diagram) | Yes | The diagram data |

### Diagram

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string (uuid) | Yes | Unique diagram identifier |
| `name` | string | Yes | Human-readable diagram name (1-255 chars) |
| `tables` | [Table](#table)[] | Yes | List of tables in the diagram |
| `relationships` | [Relationship](#relationship)[] | Yes | Foreign key relationships |
| `uniqueConstraints` | [UniqueConstraint](#uniqueconstraint)[] | Yes | Unique constraints on tables |
| `indexes` | [Index](#index)[] | Yes | Indexes on tables |
| `createdAt` | string (date-time) | Yes | Creation timestamp (ISO 8601) |
| `updatedAt` | string (date-time) | Yes | Last modification timestamp (ISO 8601) |

### Table

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string (uuid) | Yes | Unique table identifier |
| `name` | string | Yes | Table name (alphanumeric + underscore, starting with letter or underscore) |
| `x` | number | Yes | Canvas X position (pixels, >= 0) |
| `y` | number | Yes | Canvas Y position (pixels, >= 0) |
| `width` | number | Yes | Canvas width (pixels, >= 1) |
| `height` | number | Yes | Canvas height (pixels, >= 1) |
| `columns` | [Column](#column)[] | Yes | List of columns in the table |

### Column

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string (uuid) | Yes | Unique column identifier |
| `name` | string | Yes | Column name (alphanumeric + underscore, starting with letter or underscore) |
| `type` | string | Yes | SQL data type (e.g. `serial`, `integer`, `varchar`, `text`, `boolean`, `timestamp`, `numeric`) |
| `length` | integer \| null | No | Max length for character types; null for types without length |
| `nullable` | boolean | Yes | Whether NULL values are allowed |
| `primaryKey` | boolean | Yes | Whether the column is part of the primary key |
| `unique` | boolean | No | Single-column unique constraint shortcut |
| `defaultValue` | string \| null | No | Default value (SQL expression or literal); null = no default |
| `comment` | string \| null | No | Optional description |

### Relationship (Foreign Key)

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string (uuid) | Yes | Unique relationship identifier |
| `sourceTableId` | string (uuid) | Yes | Table containing the foreign key column |
| `sourceColumnId` | string (uuid) \| null | No | Foreign key column ID; null for table-level relationships |
| `targetTableId` | string (uuid) | Yes | Referenced (parent) table ID |
| `targetColumnId` | string (uuid) \| null | No | Primary key column ID; null for table-level relationships |
| `onDelete` | string | No | Referential action on delete: `cascade`, `set null`, `set default`, `restrict`, `no action` |
| `onUpdate` | string | No | Referential action on update: `cascade`, `set null`, `set default`, `restrict`, `no action` |

### UniqueConstraint

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string (uuid) | Yes | Unique constraint identifier |
| `tableId` | string (uuid) | Yes | Table the constraint belongs to |
| `columnIds` | string[] | Yes | Column IDs in the constraint (supports composite constraints, min 1) |
| `name` | string \| null | No | Constraint name; auto-generated if null |

### Index

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string (uuid) | Yes | Unique index identifier |
| `tableId` | string (uuid) | Yes | Table the index belongs to |
| `columnIds` | string[] | Yes | Column IDs in the index (supports composite indexes, min 1) |
| `unique` | boolean | Yes | Whether the index enforces uniqueness |
| `name` | string \| null | No | Index name; auto-generated if null |

## Security

**No database credentials are ever serialized to JSON.** The schema explicitly omits host, port, database, user, and password fields. The serializer includes a `hasCredentials()` guard that rejects any JSON containing credential fields.

## Acceptance Criteria Coverage

| Criterion | Schema Coverage |
|---|---|
| Table structure | [`Table`](#table) definition with id, name, position, size, columns |
| Column structure | [`Column`](#column) definition with name, type, nullable, default |
| Primary key | `Column.primaryKey` boolean flag |
| Foreign key | [`Relationship`](#relationship) with source/target table and column IDs |
| Unique constraint | [`UniqueConstraint`](#uniqueconstraint) with table and column IDs |
| Index | [`Index`](#index) with table, column IDs, and unique flag |
| Relationship structure | [`Relationship`](#relationship) definition |
| Documented and versioned | This document + `$id`, `version`, `title`, `description` fields in schema |

## Example

See `src/schema/diagram.example.json` for a complete, schema-valid example featuring two tables (users, orders), a foreign key relationship, a unique constraint, and an index.

## Validation

The schema uses JSON Schema Draft 7 and can be validated with any compliant validator (e.g., AJV, jsonschema, structurally). All fields use `additionalProperties: false` to prevent unknown properties from being silently accepted.
