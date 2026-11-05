/**
 * Unit tests for the connection flow integration (TASK-038).
 *
 * Verifies that the ConnectionForm and useConnection hook work together
 * correctly across the full connection flow: form submission triggers
 * state management, and success/failure is properly indicated end to end.
 *
 * Acceptance criteria covered:
 *  1. Unit tests verify connection form submission
 *  2. Unit tests verify connection state management
 *  3. Unit tests verify success/failure indication
 *
 * Tests run in jsdom so the full DOM API is available without a real browser.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ConnectionForm } from '../connection/ConnectionForm';
import { useConnection } from '../hooks/useConnection';
import {
  setFetchForTesting,
  resetFetchForTesting,
} from '../connection/connectionApi';
import type { ConnectionConfig, ConnectionResult } from '../types';

function appendContainer(): HTMLElement {
  const el = document.createElement('div');
  el.id = 'test-connection-flow';
  document.body.appendChild(el);
  return el;
}

const testConfig: ConnectionConfig = {
  host: 'db.example.com',
  port: 5433,
  database: 'mydb',
  user: 'app_user',
  password: 's3cret',
  schema: 'public',
};

describe('Connection flow: form submission triggers hook state management', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = appendContainer();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('calls the connect callback with current field values on form submit', async () => {
    const connectMock = vi.fn(async (): Promise<ConnectionResult> => ({
      success: true,
      message: 'Connected',
    }));

    // Simulate useConnection's connect being passed as submitConnection
    new ConnectionForm({ container, submitConnection: connectMock });

    const host = document.getElementById('conn-host') as HTMLInputElement;
    const port = document.getElementById('conn-port') as HTMLInputElement;
    const database = document.getElementById('conn-database') as HTMLInputElement;
    const user = document.getElementById('conn-user') as HTMLInputElement;
    const password = document.getElementById('conn-password') as HTMLInputElement;

    host.value = testConfig.host;
    port.value = String(testConfig.port);
    database.value = testConfig.database;
    user.value = testConfig.user;
    password.value = testConfig.password;

    const form = document.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { cancelable: true }));

    await Promise.resolve();

    expect(connectMock).toHaveBeenCalledTimes(1);
    expect(connectMock).toHaveBeenCalledWith(testConfig);
  });

  it('shows success status and resets form when connect succeeds', async () => {
    const connectMock = vi.fn(async (): Promise<ConnectionResult> => ({
      success: true,
      message: 'Connection established',
    }));

    new ConnectionForm({ container, submitConnection: connectMock });

    const host = document.getElementById('conn-host') as HTMLInputElement;
    host.value = 'custom.example.com';

    const form = document.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { cancelable: true }));

    await Promise.resolve();

    const status = document.getElementById('connection-status');
    expect(status).not.toBeNull();
    expect(status!.textContent).toContain('Connection established');
    expect(status!.classList.contains('connection-status--success')).toBe(true);

    // Form is reset and defaults re-applied after success
    expect(host.value).toBe('localhost');
    const password = document.getElementById('conn-password') as HTMLInputElement;
    expect(password.value).toBe('');
  });

  it('shows error status when connect reports failure', async () => {
    const connectMock = vi.fn(async (): Promise<ConnectionResult> => ({
      success: false,
      error: 'Invalid credentials',
    }));

    new ConnectionForm({ container, submitConnection: connectMock });

    const form = document.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { cancelable: true }));

    await Promise.resolve();

    const status = document.getElementById('connection-status');
    expect(status!.textContent).toContain('Invalid credentials');
    expect(status!.classList.contains('connection-status--error')).toBe(true);
  });

  it('shows error status when connect throws a network error', async () => {
    const connectMock = vi.fn(async (): Promise<ConnectionResult> => {
      throw new TypeError('Failed to fetch');
    });

    new ConnectionForm({ container, submitConnection: connectMock });

    const form = document.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { cancelable: true }));

    await Promise.resolve();

    const status = document.getElementById('connection-status');
    // ConnectionForm catches thrown errors and shows a generic message
    expect(status!.textContent).toContain('Unexpected error while connecting');
    expect(status!.classList.contains('connection-status--error')).toBe(true);
  });

  it('disables the submit button while connect is in flight', async () => {
    let resolveRelease: (result: ConnectionResult) => void = () => {};
    const connectMock = vi.fn(
      async (): Promise<ConnectionResult> =>
        new Promise((resolve) => {
          resolveRelease = resolve;
        }),
    );

    new ConnectionForm({ container, submitConnection: connectMock });

    const form = document.querySelector('form') as HTMLFormElement;
    const button = document.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement;

    form.dispatchEvent(new Event('submit', { cancelable: true }));

    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');

    resolveRelease({ success: true, message: 'Connected' });
    await new Promise((r) => setTimeout(r, 0));

    expect(button.disabled).toBe(false);
    expect(button.getAttribute('aria-busy')).toBe('false');
  });

  it('does not submit again while already connecting', async () => {
    const calls: ConnectionConfig[] = [];
    const connectMock = vi.fn(
      async (config: ConnectionConfig): Promise<ConnectionResult> => {
        calls.push(config);
        await new Promise((r) => setTimeout(r, 10));
        return { success: true };
      },
    );

    new ConnectionForm({ container, submitConnection: connectMock });

    const form = document.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    form.dispatchEvent(new Event('submit', { cancelable: true }));

    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 20));

    expect(connectMock).toHaveBeenCalledTimes(1);
  });
});

describe('Connection flow: hook state management with form-like config', () => {
  let originalFetch: typeof fetch;
  const mockFetch = vi.fn();

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    mockFetch.mockClear();
    globalThis.fetch = mockFetch as unknown as typeof fetch;
    setFetchForTesting(globalThis.fetch as unknown as typeof fetch);
  });

  afterEach(() => {
    resetFetchForTesting();
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('transitions from disconnected to connected on successful connect', async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ message: 'Connection established' }), {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const { result } = renderHook(() => useConnection());

    await act(async () => {
      await result.current.connect(testConfig);
    });

    expect(result.current.status).toBe('connected');
    expect(result.current.isConnected).toBe(true);
    expect(result.current.config).toEqual(testConfig);
    expect(result.current.message).toBe('Connection established');
    expect(result.current.error).toBeNull();
  });

  it('transitions to error on failed connect, keeping config in memory', async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ message: 'Invalid credentials' }), {
        status: 401,
        statusText: 'Unauthorized',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const { result } = renderHook(() => useConnection());

    await act(async () => {
      await result.current.connect(testConfig);
    });

    expect(result.current.status).toBe('error');
    expect(result.current.isConnected).toBe(false);
    expect(result.current.error).toBe('Invalid credentials');
    expect(result.current.message).toBeNull();
    // Credentials remain in memory even on failure
    expect(result.current.config).toEqual(testConfig);
  });

  it('transitions to disconnected on disconnect, clearing credentials', async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ message: 'Connected' }), {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const { result } = renderHook(() => useConnection());

    await act(async () => {
      await result.current.connect(testConfig);
    });
    expect(result.current.status).toBe('connected');

    act(() => {
      result.current.disconnect();
    });

    expect(result.current.status).toBe('disconnected');
    expect(result.current.isConnected).toBe(false);
    expect(result.current.config).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.message).toBeNull();
  });

  it('clears success/error messages with clearMessage', async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ message: 'Connected' }), {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const { result } = renderHook(() => useConnection());

    await act(async () => {
      await result.current.connect(testConfig);
    });
    expect(result.current.message).toBe('Connected');

    act(() => {
      result.current.clearMessage();
    });

    expect(result.current.message).toBeNull();
    expect(result.current.error).toBeNull();
    // Status remains connected after clearing message
    expect(result.current.status).toBe('connected');
  });
});
