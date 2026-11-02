/**
 * Request body validation for the test-connection endpoint.
 *
 * Mirrors §2 of the TASK-051 API specification. No connection attempt is made
 * when validation fails (§4.2).
 */

/**
 * Validates the connection request body.
 *
 * @returns null when the body is valid, otherwise a descriptive error message
 * listing the invalid fields (suitable for a 400 response).
 */
export function validateTestConnectionRequest(
  body: unknown,
): string | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return 'Validation error: request body must be a JSON object.';
  }

  const b = body as Record<string, unknown>;
  const invalid: string[] = [];

  if (
    typeof b.host !== 'string' ||
    b.host.trim() === ''
  ) {
    invalid.push('host');
  }

  if (
    typeof b.port !== 'number' ||
    !Number.isInteger(b.port) ||
    b.port < 1 ||
    b.port > 65535
  ) {
    invalid.push('port');
  }

  if (
    typeof b.database !== 'string' ||
    b.database.trim() === ''
  ) {
    invalid.push('database');
  }

  if (typeof b.user !== 'string' || b.user.trim() === '') {
    invalid.push('user');
  }

  if (typeof b.password !== 'string') {
    invalid.push('password');
  }

  if (invalid.length === 0) {
    return null;
  }

  const quoted = invalid.map((f) => `"${f}"`).join(', ');
  const isSingle = invalid.length === 1;
  const article = isSingle ? 'field' : 'fields';
  const verb = isSingle ? 'is required' : 'are required';
  return `Validation error: ${article} ${quoted} ${verb}.`;
}
