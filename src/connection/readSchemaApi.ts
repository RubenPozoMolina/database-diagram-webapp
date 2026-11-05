/**
 * Read-schema API client for introspecting PostgreSQL schema via the backend.
 *
 * The default endpoint is `/api/read-schema`. A custom URL can be supplied per call,
 * and the underlying `fetch` implementation can be replaced for testing via
 * `setFetchForTesting` / `resetFetchForTesting`.
 *
 * Implements the frontend side of STORY-017 (US-4.2 Read Schema): given an active
 * connection, the frontend calls the read-schema endpoint and the backend returns
 * tables, columns, data types, primary keys, foreign keys, unique constraints,
 * and indexes in a structured format.
 */

import type { ConnectionConfig } from '../types';

const DEFAULT_API_URL = '/api/read-schema';

let fetchImpl: typeof fetch = fetch;

/**
 * Replaces the fetch implementation used by readSchema. Intended for tests.
 */
export function setFetchForTesting(impl: typeof fetch): void {
  fetchImpl = impl;
}

/**
 * Restores the real fetch implementation.
 */
export function resetFetchForTesting(): void {
  fetchImpl = fetch;
}

/**
 * Request sent to the POST /api/read-schema endpoint.
 */
export interface ReadSchemaRequest {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  schema?: string;
}

/**
 * A column as returned by the read-schema endpoint.
 */
export interface ReadSchemaColumn {
  name: string;
  dataType: string;
  isNullable: boolean;
  columnDefault: string | null;
  maxLength: number | null;
  numericPrecision: number | null;
  numericScale: number | null;
  datetimePrecision: number | null;
  intervalType: string | null;
}

/**
 * A primary key constraint as returned by the read-schema endpoint.
 */
export interface ReadSchemaPrimaryKey {
  constraintName: string;
  columns: string[];
}

/**
 * A foreign key constraint as returned by the read-schema endpoint.
 */
export interface ReadSchemaForeignKey {
  constraintName: string;
  column: string;
  foreignTable: string;
  foreignColumn: string;
  updateRule: string;
  deleteRule: string;
}

/**
 * A unique constraint as returned by the read-schema endpoint.
 */
export interface ReadSchemaUniqueConstraint {
  constraintName: string;
  columns: string[];
}

/**
 * An index as returned by the read-schema endpoint.
 */
export interface ReadSchemaIndex {
  name: string;
  columns: string[];
  isUnique: boolean;
  isPrimary: boolean;
  isValid: boolean;
  indexType: string;
  definition: string;
}

/**
 * A table as returned by the read-schema endpoint.
 */
export interface ReadSchemaTable {
  name: string;
  columns: ReadSchemaColumn[];
  primaryKeys: ReadSchemaPrimaryKey[];
  foreignKeys: ReadSchemaForeignKey[];
  uniqueConstraints: ReadSchemaUniqueConstraint[];
  indexes: ReadSchemaIndex[];
}

/**
 * Successful response from the read-schema endpoint.
 */
export interface ReadSchemaResponse {
  success: true;
  schema: string;
  tables: ReadSchemaTable[];
}

/**
 * Error response from the read-schema endpoint.
 */
export interface ReadSchemaError {
  success: false;
  error: string;
}

export type ReadSchemaResult = ReadSchemaResponse | ReadSchemaError;

/**
 * Introspects a PostgreSQL schema by calling the backend read-schema endpoint.
 *
 * Returns a ReadSchemaResult: on success, the structured schema data including
 * tables, columns, data types, primary keys, foreign keys, unique constraints
 * and indexes. On failure, an error descriptor with `success: false`.
 *
 * Network errors and non-ok HTTP responses are surfaced as failure results
 * rather than thrown. The database password is sent in the request body but
 * is never logged or persisted.
 */
export async function readSchema(
  config: ConnectionConfig,
  apiUrl: string = DEFAULT_API_URL,
): Promise<ReadSchemaResult> {
  try {
    const response = await fetchImpl(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        password: config.password,
        schema: config.schema,
      }),
    });

    if (!response.ok) {
      let message = `HTTP ${response.status}`;
      try {
        const body = (await response.json()) as { error?: string };
        if (body.error) {
          message = body.error;
        }
      } catch {
        message = response.statusText || message;
      }
      return { success: false, error: message };
    }

    const body = (await response.json()) as ReadSchemaResult;
    return body;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
