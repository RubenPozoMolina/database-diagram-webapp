/**
 * DDL API client for applying PostgreSQL schema changes.
 *
 * Provides functions to send generated DDL to the backend's apply-schema
 * endpoint. The backend requires an explicit `confirm: true` flag before
 * executing any DDL, enforcing the "no DDL without confirmation" rule at the
 * API level as well.
 *
 * The underlying fetch implementation can be replaced for testing via
 * `setFetchForTesting` / `resetFetchForTesting`.
 */

import type { ConnectionConfig } from '../types';

export const DEFAULT_API_URL = '/api/apply-schema';

let fetchImpl: typeof fetch = fetch;

/**
 * Replaces the fetch implementation used by applyDDL. Intended for tests.
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
 * Result of applying DDL to the database.
 */
export interface ApplyDdlResult {
  success: boolean;
  message: string;
  ddlPreview: string;
}

/**
 * Sends DDL to the backend for execution. The backend only executes the DDL
 * when `confirm` is true; otherwise it returns a "Confirmation required" error.
 *
 * @param ddl - The generated DDL SQL script to apply.
 * @param config - The active PostgreSQL connection configuration.
 * @param confirm - Whether the user has explicitly confirmed execution.
 * @param apiUrl - Optional override for the apply-schema endpoint URL.
 * @returns The apply result (success/failure).
 */
export async function applyDDL(
  ddl: string,
  config: ConnectionConfig,
  confirm: boolean,
  apiUrl: string = DEFAULT_API_URL,
): Promise<ApplyDdlResult> {
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
        schema: 'public',
        ddl,
        confirm,
      }),
    });

    const body = (await response.json()) as ApplyDdlResult;

    if (!response.ok) {
      return {
        success: false,
        message: body.message ?? `HTTP ${response.status}`,
        ddlPreview: body.ddlPreview ?? ddl,
      };
    }

    return {
      success: body.success ?? true,
      message: body.message ?? 'Schema applied successfully',
      ddlPreview: body.ddlPreview ?? ddl,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
      ddlPreview: ddl,
    };
  }
}
