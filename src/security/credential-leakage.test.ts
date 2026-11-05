/**
 * Security tests: credential leakage in JSON export.
 *
 * Verifies that no database credentials (host, port, database, user, password)
 * ever appear in exported JSON files, under any circumstance — including when
 * credentials are injected into the diagram model or payload.
 *
 * Maps to STORY-011 / TASK-035 acceptance criteria: each credential field is
 * verified independently so that a regression in any single field is caught
 * with a dedicated, named test.
 */

import { describe, it, expect } from 'vitest';
import { createEmptyDiagram } from '../types/diagram';
import {
  CREDENTIAL_FIELDS,
  serializeDiagram,
  stripCredentials,
} from '../serialization/diagramSerializer';

const CREDENTIAL_KEYS = ['host', 'port', 'database', 'user', 'password'];

/**
 * Builds a diagram with credentials injected at the diagram level and inside
 * a table/column, simulating a future model extension that mistakenly carries
 * connection details.
 */
function buildTaintedDiagram(): ReturnType<typeof createEmptyDiagram> {
  const diagram = createEmptyDiagram('Tainted Diagram');
  // Inject credentials at the diagram root level.
  (diagram as Record<string, unknown>).host = 'db.example.com';
  (diagram as Record<string, unknown>).port = 5432;
  (diagram as Record<string, unknown>).database = 'mydb';
  (diagram as Record<string, unknown>).user = 'app_user';
  (diagram as Record<string, unknown>).password = 's3cret';
  // Inject credentials inside a table and a column.
  diagram.tables.push({
    id: 'table-users',
    name: 'users',
    x: 100,
    y: 100,
    width: 240,
    height: 200,
    columns: [
      {
        id: 'col-users-id',
        name: 'id',
        dataType: 'serial',
        nullable: false,
        primaryKey: true,
        host: 'injected-host',
        password: 'leaked-pw',
      },
      {
        id: 'col-users-email',
        name: 'email',
        dataType: 'varchar',
        nullable: false,
        primaryKey: false,
        port: 5432,
        database: 'injected-db',
        user: 'injected-user',
      },
    ],
    indexes: [],
  });
  return diagram;
}

/**
 * Serializes the diagram to JSON and asserts that the given credential field
 * does not appear as a JSON key anywhere in the serialized payload.
 * Using `"field"` (with quotes) avoids false positives from substring matches
 * (e.g. "users" containing "user").
 */
function assertNoCredentialKey(serialized: string, field: string): void {
  const lower = serialized.toLowerCase();
  expect(lower).not.toContain(`"${field}"`);
}

/**
 * Serializes a clean diagram and asserts that the given credential field is
 * absent from the exported JSON.
 */
function assertCleanExportHasNoCredential(
  diagram: ReturnType<typeof createEmptyDiagram>,
  field: string,
): void {
  const result = serializeDiagram(diagram);
  const serialized = JSON.stringify(result);
  assertNoCredentialKey(serialized, field);
}

describe('Credential leakage security — serializeDiagram', () => {
  it('AC1: verifies no host field in exported JSON', () => {
    const diagram = buildTaintedDiagram();
    const result = serializeDiagram(diagram);
    const serialized = JSON.stringify(result);
    assertNoCredentialKey(serialized, 'host');
  });

  it('AC2: verifies no port field in exported JSON', () => {
    const diagram = buildTaintedDiagram();
    const result = serializeDiagram(diagram);
    const serialized = JSON.stringify(result);
    assertNoCredentialKey(serialized, 'port');
  });

  it('AC3: verifies no database field in exported JSON', () => {
    const diagram = buildTaintedDiagram();
    const result = serializeDiagram(diagram);
    const serialized = JSON.stringify(result);
    assertNoCredentialKey(serialized, 'database');
  });

  it('AC4: verifies no user field in exported JSON', () => {
    const diagram = buildTaintedDiagram();
    const result = serializeDiagram(diagram);
    const serialized = JSON.stringify(result);
    assertNoCredentialKey(serialized, 'user');
  });

  it('AC5: verifies no password field in exported JSON', () => {
    const diagram = buildTaintedDiagram();
    const result = serializeDiagram(diagram);
    const serialized = JSON.stringify(result);
    assertNoCredentialKey(serialized, 'password');
  });

  it('clean diagram export contains no credential fields', () => {
    const diagram = createEmptyDiagram('Clean Diagram');
    const result = serializeDiagram(diagram);
    const serialized = JSON.stringify(result).toLowerCase();
    for (const field of CREDENTIAL_FIELDS) {
      expect(serialized).not.toContain(`"${field}"`);
    }
    expect(result.diagram.name).toBe('Clean Diagram');
  });

  it('all credential fields are absent simultaneously in tainted export', () => {
    const diagram = buildTaintedDiagram();
    const result = serializeDiagram(diagram);
    const serialized = JSON.stringify(result).toLowerCase();
    for (const field of CREDENTIAL_FIELDS) {
      expect(serialized).not.toContain(`"${field}"`);
    }
    // Non-credential data is preserved.
    expect(result.diagram.name).toBe('Tainted Diagram');
  });
});

describe('Credential leakage security — stripCredentials', () => {
  it('removes every credential field from nested objects', () => {
    const dirty = {
      version: '1.0.0',
      diagram: {
        id: 'abc',
        name: 'My Diagram',
        host: 'db.example.com',
        port: 5432,
        database: 'mydb',
        user: 'app_user',
        password: 's3cret',
        tables: [
          {
            id: 't1',
            name: 'accounts',
            host: 'injected-host',
            columns: [{ id: 'c1', name: 'id', password: 'leaked-pw' }],
          },
        ],
      },
    };
    const cleaned = stripCredentials(dirty);
    const serialized = JSON.stringify(cleaned).toLowerCase();
    for (const field of CREDENTIAL_FIELDS) {
      expect(serialized).not.toContain(field);
    }
    // Non-credential data is preserved.
    expect(cleaned).toMatchObject({
      version: '1.0.0',
      diagram: { id: 'abc', name: 'My Diagram' },
    });
  });

  it('strips credentials case-insensitively (HOST, Port, DATABASE, User, PASSWORD)', () => {
    const dirty = {
      HOST: 'db.example.com',
      Port: 5432,
      DATABASE: 'mydb',
      User: 'app_user',
      PASSWORD: 's3cret',
      safe: 'keep-me',
    };
    const cleaned = stripCredentials(dirty) as Record<string, unknown>;
    expect(cleaned).toEqual({ safe: 'keep-me' });
  });

  it('preserves arrays of non-credential objects while stripping credential fields', () => {
    const dirty = {
      items: [
        { name: 'table-a', host: 'bad' },
        { name: 'table-b', password: 'bad' },
        { name: 'table-c', user: 'bad', port: 5432, database: 'bad' },
      ],
    };
    const cleaned = stripCredentials(dirty);
    expect(cleaned).toEqual({
      items: [{ name: 'table-a' }, { name: 'table-b' }, { name: 'table-c' }],
    });
  });
});
