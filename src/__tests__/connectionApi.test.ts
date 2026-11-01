/**
 * Unit tests for the connection API client (TASK-036).
 *
 * Covers successful submissions, failed HTTP responses and network errors.
 * The global `fetch` is replaced with a fake implementation for each test.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  submitConnection,
  setFetchForTesting,
  resetFetchForTesting,
} from '../connection/connectionApi';
import type { ConnectionConfig } from '../types';

const config: ConnectionConfig = {
  host: 'db.example.com',
  port: 5433,
  database: 'mydb',
  user: 'app_user',
  password: 's3cret',
};

describe('submitConnection', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    resetFetchForTesting();
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('POSTs the connection config as JSON to the backend', async () => {
    let capturedUrl = '';
    let capturedInit: RequestInit | undefined;
    let capturedBody: string | undefined;

    globalThis.fetch = vi.fn(async (_url, init) => {
      capturedUrl = String(_url);
      capturedInit = init;
      capturedBody = init?.body as string | undefined;
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ message: 'Connected' }),
      } as unknown as Response;
    });
    setFetchForTesting(globalThis.fetch as typeof fetch);

    await submitConnection(config);

    expect(capturedUrl).toBe('/api/connections');
    expect(capturedInit?.method).toBe('POST');
    expect(capturedInit?.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(capturedBody).toBe(JSON.stringify(config));
  });

  it('returns success when the backend responds OK', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ message: 'Connection saved' }),
    }) as unknown as Response);
    setFetchForTesting(globalThis.fetch as typeof fetch);

    const result = await submitConnection(config);

    expect(result).toEqual({ success: true, message: 'Connection saved' });
  });

  it('returns failure when the backend responds with an error status', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({ message: 'Invalid credentials' }),
    }) as unknown as Response);
    setFetchForTesting(globalThis.fetch as typeof fetch);

    const result = await submitConnection(config);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid credentials');
  });

  it('returns failure when the error response has no JSON body', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => {
        throw new Error('not json');
      },
    }) as unknown as Response);
    setFetchForTesting(globalThis.fetch as typeof fetch);

    const result = await submitConnection(config);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Internal Server Error');
  });

  it('returns failure when the network request fails', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    setFetchForTesting(globalThis.fetch as typeof fetch);

    const result = await submitConnection(config);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Failed to fetch');
  });

  it('accepts a custom API URL', async () => {
    let capturedUrl = '';
    globalThis.fetch = vi.fn(async (_url) => {
      capturedUrl = String(_url);
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({}),
      } as unknown as Response;
    });
    setFetchForTesting(globalThis.fetch as typeof fetch);

    await submitConnection(config, 'https://api.example.com/connections');

    expect(capturedUrl).toBe('https://api.example.com/connections');
  });
});
