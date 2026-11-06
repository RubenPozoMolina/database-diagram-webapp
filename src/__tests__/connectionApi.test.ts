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
import { ConnectionForm } from '../connection/ConnectionForm';
import type { ConnectionConfig } from '../types';

const config: ConnectionConfig = {
  host: 'db.example.com',
  port: 5433,
  database: 'mydb',
  user: 'app_user',
  password: 's3cret',
  schema: 'public',
};

function appendContainer(): HTMLElement {
  const el = document.createElement('div');
  el.id = 'test-connection-form-integration';
  document.body.appendChild(el);
  return el;
}

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

    expect(capturedUrl).toBe('/api/v1/connections/test');
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

  it('returns the backend `error` field when the connection fails', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({
        success: false,
        error: 'Authentication failed: password authentication failed for user "app_user".',
      }),
    }) as unknown as Response);
    setFetchForTesting(globalThis.fetch as typeof fetch);

    const result = await submitConnection(config);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Authentication failed');
    // The password must never be echoed back to the client.
    expect(result.error).not.toContain(config.password);
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

/**
 * Integration tests for the full ConnectionForm → submitConnection → fetch flow.
 *
 * Verifies that submitting the connection form calls the test-connection
 * endpoint and displays success or failure to the user (TASK-053 acceptance
 * criteria 1, 2 and 3).
 */
describe('ConnectionForm integration with test-connection endpoint', () => {
  let container: HTMLElement;
  let capturedUrl: string;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    container = appendContainer();
    capturedUrl = '';
    fetchMock = vi.fn(async (_url: string, _init: RequestInit) => {
      capturedUrl = String(_url);
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ message: 'Connection successful' }),
      } as unknown as Response;
    });
    globalThis.fetch = fetchMock;
    setFetchForTesting(globalThis.fetch as typeof fetch);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    resetFetchForTesting();
    vi.restoreAllMocks();
  });

  async function flushPromises(): Promise<void> {
    await new Promise((r) => setTimeout(r, 0));
  }

  it('calls the test-connection endpoint on form submit', async () => {
    new ConnectionForm({ container });

    const form = document.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { cancelable: true }));

    await flushPromises();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(capturedUrl).toBe('/api/v1/connections/test');
  });

  it('displays success status when the backend responds OK', async () => {
    new ConnectionForm({ container });

    const form = document.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { cancelable: true }));

    await flushPromises();

    const status = document.getElementById('connection-status');
    expect(status).not.toBeNull();
    expect(status!.textContent).toContain('Connection successful');
    expect(status!.classList.contains('connection-status--success')).toBe(true);
  });

  it('displays a descriptive error when the backend reports failure', async () => {
    fetchMock.mockImplementationOnce(async () => ({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({ message: 'Invalid credentials' }),
    }) as unknown as Response);

    new ConnectionForm({ container });

    const form = document.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { cancelable: true }));

    await flushPromises();

    const status = document.getElementById('connection-status');
    expect(status).not.toBeNull();
    expect(status!.textContent).toContain('Invalid credentials');
    expect(status!.classList.contains('connection-status--error')).toBe(true);
  });

  it('displays a descriptive error when the network request fails', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    new ConnectionForm({ container });

    const form = document.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { cancelable: true }));

    await flushPromises();

    const status = document.getElementById('connection-status');
    expect(status).not.toBeNull();
    expect(status!.textContent).toContain('Failed to fetch');
    expect(status!.classList.contains('connection-status--error')).toBe(true);
  });
});
