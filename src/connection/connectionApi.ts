/**
 * Connection API client for submitting PostgreSQL connection details to the backend.
 *
 * The default endpoint is `/api/connections`. A custom URL can be supplied per call,
 * and the underlying `fetch` implementation can be replaced for testing via
 * `setFetchForTesting` / `resetFetchForTesting`.
 */

import type { ConnectionConfig, ConnectionResult } from '../types';

const DEFAULT_API_URL = '/api/v1/connections/test';

let fetchImpl: typeof fetch = fetch;

/**
 * Replaces the fetch implementation used by submitConnection. Intended for tests.
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
 * Submits a PostgreSQL connection configuration to the backend.
 *
 * Returns a ConnectionResult indicating success or failure. Network errors and
 * non-ok HTTP responses are surfaced as failure results rather than thrown.
 */
export async function submitConnection(
  config: ConnectionConfig,
  apiUrl: string = DEFAULT_API_URL,
): Promise<ConnectionResult> {
  try {
    const response = await fetchImpl(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      let message = `HTTP ${response.status}`;
      try {
        const body = (await response.json()) as { error?: string; message?: string };
        // The backend surfaces descriptive failures in the `error` field; fall
        // back to `message` for backward compatibility with other responses.
        if (body.error) {
          message = body.error;
        } else if (body.message) {
          message = body.message;
        }
      } catch {
        // Ignore JSON parse errors; fall back to the status text.
        message = response.statusText || message;
      }
      return { success: false, error: message };
    }

    let message = 'Connection saved';
    try {
      const body = (await response.json()) as { message?: string };
      if (body.message) {
        message = body.message;
      }
    } catch {
      // Ignore JSON parse errors; use the default message.
    }
    return { success: true, message };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
