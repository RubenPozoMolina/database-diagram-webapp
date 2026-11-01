/**
 * Request validation middleware for the test-connection endpoint.
 *
 * Validates the connection parameters before any database connection
 * attempt is made. Invalid requests return 400 without touching the
 * database.
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates the connection request body.
 *
 * Rules (per docs/api/test-connection.md §2):
 * - host: non-empty string
 * - port: integer in range 1..65535
 * - database: non-empty string
 * - user: non-empty string
 * - password: non-empty string (any characters allowed)
 */
export function validateConnectionParams(body: unknown): ValidationResult {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { valid: false, error: 'Request body is required.' };
  }

  const params = body as Record<string, unknown>;

  const host = params.host;
  if (typeof host !== 'string' || host.trim() === '') {
    return { valid: false, error: 'field "host" is required.' };
  }

  const port = params.port;
  if (
    typeof port !== 'number' ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    return {
      valid: false,
      error: 'field "port" must be an integer between 1 and 65535.',
    };
  }

  const database = params.database;
  if (typeof database !== 'string' || database.trim() === '') {
    return { valid: false, error: 'field "database" is required.' };
  }

  const user = params.user;
  if (typeof user !== 'string' || user.trim() === '') {
    return { valid: false, error: 'field "user" is required.' };
  }

  const password = params.password;
  if (typeof password !== 'string' || password === '') {
    return { valid: false, error: 'field "password" is required.' };
  }

  return { valid: true };
}
