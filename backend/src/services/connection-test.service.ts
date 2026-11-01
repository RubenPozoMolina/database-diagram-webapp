/**
 * PostgreSQL connection test service.
 *
 * Attempts a real TCP connection + authentication to PostgreSQL 14+ using the
 * supplied credentials, applies a bounded connection timeout, categorises
 * failures into the HTTP status codes defined by the API specification, and
 * always closes the underlying connection. Credentials are held in memory for
 * the duration of the request only and never appear in error messages.
 */

import { Client } from 'pg';
import type { ConnectionParams, ConnectionResult } from './types/connection';

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * PostgreSQL error codes that indicate an authentication failure (invalid
 * credentials, unknown user, insufficient privileges, or unknown database).
 * These map to HTTP 401 per §4.1 of the API specification.
 */
const AUTH_ERROR_CODES = new Set([
  '28P01', // invalid_password
  '28000', // invalid_authorization_specification
  '3D000', // invalid_catalog_name (database does not exist)
  '53300', // too_many_connections
]);

/**
 * Node.js network error codes indicating the backend could not reach the
 * PostgreSQL server. These map to HTTP 502 Bad Gateway per §4.3.
 */
const NETWORK_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ENOTFOUND',
  'ENETUNREACH',
  'EAI_AGAIN',
  'ECONNRESET',
  'ENETDOWN',
  'ENETRESET',
  'ENOTCONN',
  'EHOSTUNREACH',
  'EHOSTDOWN',
]);

export interface ConnectionParams {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

export interface ConnectionResult {
  success: boolean;
  message?: string;
  error?: string;
  statusCode?: number;
}

/**
 * Redacts any occurrence of the password from an error message so credentials
 * are never leaked to the client (§4.6 of the API specification).
 */
function sanitizeErrorMessage(message: string, password: string): string {
  if (!password) {
    return message;
  }
  return message.split(password).join('***');
}

function categorizeError(
  err: unknown,
  params: ConnectionParams,
  timeoutMs: number,
): ConnectionResult {
  const message = err instanceof Error ? err.message : String(err);
  const code = (err as { code?: string })?.code;

  // Network unreachable / connection refused / DNS failure -> 502
  if (NETWORK_ERROR_CODES.has(code)) {
    return {
      success: false,
      error: `Unable to reach PostgreSQL server at ${params.host}:${params.port}: ${message}.`,
      statusCode: 502,
    };
  }

  // PostgreSQL authentication errors -> 401 (password redacted)
  if (AUTH_ERROR_CODES.has(code)) {
    return {
      success: false,
      error: `Authentication failed: ${sanitizeErrorMessage(message, params.password)}.`,
      statusCode: 401,
    };
  }

  // Connection timeout -> 504
  const isTimeout =
    code === 'ETIMEDOUT' ||
    /timeout/i.test(message) ||
    /timed\s*out/i.test(message) ||
    (err instanceof Error && err.name === 'TimeoutError');
  if (isTimeout) {
    return {
      success: false,
      error: `Connection attempt timed out after ${timeoutMs / 1000} seconds.`,
      statusCode: 504,
    };
  }

  // Unexpected backend error -> 500 (generic, no internals leaked)
  return {
    success: false,
    error: 'Unable to test the connection. Please try again later.',
    statusCode: 500,
  };
}

/**
 * Tests a PostgreSQL connection by opening a real TCP connection and
 * authenticating with the supplied credentials.
 *
 * @returns a result object describing success or a categorised failure.
 * @throws nothing - all errors are captured in the returned result.
 */
export async function testConnection(
  params: ConnectionParams,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<ConnectionResult> {
  const client = new Client({
    host: params.host,
    port: params.port,
    database: params.database,
    user: params.user,
    password: params.password,
    connectionTimeoutMillis: timeoutMs,
  });

  let connected = false;

  // Bounded connection timeout so the frontend is not blocked indefinitely (§4.4).
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(
      () => reject(new Error('Connection attempt timed out')),
      timeoutMs,
    );
  });

  try {
    await Promise.race([client.connect(), timeoutPromise]);
    connected = true;

    await client.end();
    return {
      success: true,
      message: 'Connection to PostgreSQL established successfully.',
    };
  } catch (err) {
    // Always close the underlying connection, even on failure (§6: close immediately).
    try {
      await client.end();
    } catch {
      // Ignore errors while closing a connection that never opened.
    }
    return categorizeError(err, params, timeoutMs);
  } finally {
    // Defensive: ensure the client is released if anything slipped through.
    if (!connected) {
      try {
        await client.end();
      } catch {
        // Ignore.
      }
    }
  }
}
