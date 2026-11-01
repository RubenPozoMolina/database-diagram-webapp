/**
 * PostgreSQL connection test service.
 *
 * Attempts a real TCP connection + authentication to PostgreSQL 14+ using
 * the node-postgres (pg) client. The connection is closed immediately after
 * the test completes (success or failure). Credentials are never logged and
 * never included in error responses.
 */

import { Client } from 'pg';
import type { ConnectionParams, TestResult } from '../types';

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Sanitises an error message so it never leaks the password or internals.
 */
function sanitize(message: string): string {
  return message.replace(/\bpassword\b/gi, '[redacted]');
}

export class PostgresConnectionService {
  private readonly timeoutMs: number;

  constructor(timeoutMs: number = DEFAULT_TIMEOUT_MS) {
    this.timeoutMs = timeoutMs;
  }

  /**
   * Tests a PostgreSQL connection with the given parameters.
   *
   * Returns a TestResult with success=true on success, or success=false with
   * a descriptive error and appropriate HTTP status code on failure.
   */
  async testConnection(params: ConnectionParams): Promise<TestResult> {
    const client = new Client({
      host: params.host,
      port: params.port,
      database: params.database,
      user: params.user,
      password: params.password,
      connectionTimeoutMillis: this.timeoutMs,
    });

    try {
      await client.connect();
      await client.end();
      return {
        success: true,
        message: 'Connection to PostgreSQL established successfully.',
      };
    } catch (err) {
      // Ensure the client is closed even on failure.
      await client.end().catch(() => {
        // Ignore errors during cleanup.
      });
      return this.handleError(err);
    }
  }

  /**
   * Maps a connection error to a user-facing TestResult.
   */
  private handleError(err: unknown): TestResult {
    const pgErr = err as { code?: string; message?: string };
    const message = pgErr.message ?? 'Unknown error';
    const code = pgErr.code;
    const sanitized = sanitize(message);

    // --- Authentication failures (401) ---
    // PostgreSQL SQLSTATE 28P01 = invalid_password, 28000 = invalid_authorization_specification
    if (
      code === '28P01' ||
      code === '28000' ||
      /authentication failed/i.test(sanitized)
    ) {
      return {
        success: false,
        error: `Authentication failed: ${sanitized}`,
        statusCode: 401,
      };
    }

    // --- Network / unreachable server (502) ---
    if (
      code === 'ECONNREFUSED' ||
      code === 'ENOTFOUND' ||
      code === 'ENETUNREACH' ||
      code === 'ECONNRESET' ||
      /connection refused/i.test(sanitized) ||
      /no such host/i.test(sanitized) ||
      /network is unreachable/i.test(sanitized)
    ) {
      return {
        success: false,
        error: `Unable to reach PostgreSQL server at ${this.hostFromError(sanitized)}: ${sanitized}`,
        statusCode: 502,
      };
    }

    // --- Connection timeout (504) ---
    if (
      code === 'ETIMEDOUT' ||
      /timeout/i.test(sanitized) ||
      /timed out/i.test(sanitized)
    ) {
      return {
        success: false,
        error: `Connection attempt timed out after ${this.timeoutMs / 1000} seconds.`,
        statusCode: 504,
      };
    }

    // --- Unexpected error (500) ---
    return {
      success: false,
      error: 'Internal server error while testing connection.',
      statusCode: 500,
    };
  }

  /**
   * Best-effort extraction of host:port from an error message for the 502
   * response. Falls back to the raw message if no host/port can be found.
   */
  private hostFromError(message: string): string {
    const match = message.match(/at\s+([^\s:]+):(\d+)/);
    if (match) {
      return `${match[1]}:${match[2]}`;
    }
    return 'unknown host';
  }
}
