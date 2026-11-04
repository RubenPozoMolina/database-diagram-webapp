# Documentation

This directory contains project documentation for the Database Diagram Web Application.

## Documentation Index

| Document | Location | Description |
|---|---|---|
| Project README | `../README.md` | Project overview, architecture, setup, development, and testing instructions |
| User Guide | `user-guide.md` | How to create diagrams, import/export JSON, and integrate with PostgreSQL |
| API — Test Connection | `api/test-connection.md` | `POST /api/v1/connections/test` endpoint specification |
| API — Read Schema | `api/read-schema.md` | `POST /api/read-schema` endpoint specification |
| API — Apply Schema | `api/apply-schema.md` | `POST /api/apply-schema` endpoint specification |
| API — JSON Schema | `api/diagram-json-schema.md` | Diagram JSON serialization format and schema |
| Database Layer | `../database/README.md` | PostgreSQL schema introspection queries and verification |

## Quick Start

1. Read [`../README.md`](../README.md) for project setup and development instructions.
2. Read [`user-guide.md`](user-guide.md) for end-user instructions on creating diagrams, JSON import/export, and PostgreSQL integration.
3. Read [`api/test-connection.md`](api/test-connection.md), [`api/read-schema.md`](api/read-schema.md), and [`api/apply-schema.md`](api/apply-schema.md) for backend API details.

## Contributing to Documentation

Documentation is kept up to date with code changes. When modifying features:

- Update `README.md` for project-level changes.
- Update `docs/user-guide.md` for UI or workflow changes.
- Update `docs/api/*.md` for API contract changes.
- Update `docs/api/diagram-json-schema.md` for JSON serialization changes.