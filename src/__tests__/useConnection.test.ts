/**
 * Unit tests for useConnection hook (TASK-037).
 *
 * Acceptance criteria covered:
 *  1. Connection state tracks connected/disconnected status
 *  2. Credentials are held in memory only (not persisted)
 *  3. Connection success/failure is displayed to user
 *
 * Tests run in jsdom so the full DOM API is available without a real browser.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useConnection, EMPTY_CONFIG } from '../hooks/useConnection';
import {
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

const mockFetch = vi.fn();

function setFetchResponse(response: Response) {
  mockFetch.mockResolvedValue(response as unknown as Response);
}

function setFetchError(error: Error) {
  mockFetch.mockRejectedValue(error);
}

describe('useConnection', () => {
  let originalFetch: typeof fetch;

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

  describe('initial state', () => {
    it('starts in disconnected status with no config', () => {
      const { result } = renderHook(() => useConnection());

      expect(result.current.status).toBe('disconnected');
      expect(result.current.isConnected).toBe(false);
      expect(result.current.config).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.message).toBeNull();
    });
  });

  describe('connection state tracks connected/disconnected status (criterion 1)', () => {
    it('transitions to connecting when connect() is called', async () => {
      setFetchResponse(
        new Response(JSON.stringify({ message: 'Connected' }), {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const { result } = renderHook(() => useConnection());

      act(() => {
        result.current.connect(config);
      });

      expect(result.current.status).toBe('connecting');
      expect(result.current.isConnected).toBe(false);

      // Wait for the async operation to complete
      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.status).toBe('connected');
      expect(result.current.isConnected).toBe(true);
    });

    it('transitions to connected on successful connection', async () => {
      setFetchResponse(
        new Response(JSON.stringify({ message: 'Connection established' }), {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const { result } = renderHook(() => useConnection());

      await act(async () => {
        await result.current.connect(config);
      });

      expect(result.current.status).toBe('connected');
      expect(result.current.isConnected).toBe(true);
      expect(result.current.config).toEqual(config);
    });

    it('transitions to error on failed connection', async () => {
      setFetchResponse(
        new Response(JSON.stringify({ message: 'Invalid credentials' }), {
          status: 401,
          statusText: 'Unauthorized',
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const { result } = renderHook(() => useConnection());

      await act(async () => {
        await result.current.connect(config);
      });

      expect(result.current.status).toBe('error');
      expect(result.current.isConnected).toBe(false);
      expect(result.current.error).toBe('Invalid credentials');
      // Credentials remain in memory even on failure
      expect(result.current.config).toEqual(config);
    });

    it('transitions to disconnected on disconnect()', async () => {
      setFetchResponse(
        new Response(JSON.stringify({ message: 'Connected' }), {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const { result } = renderHook(() => useConnection());

      await act(async () => {
        await result.current.connect(config);
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

    it('clears credentials from memory on disconnect', async () => {
      setFetchResponse(
        new Response(JSON.stringify({ message: 'Connected' }), {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const { result } = renderHook(() => useConnection());

      await act(async () => {
        await result.current.connect(config);
      });
      expect(result.current.config).toEqual(config);

      act(() => {
        result.current.disconnect();
      });

      expect(result.current.config).toBeNull();
    });
  });

  describe('credentials are held in memory only (criterion 2)', () => {
    it('does not persist credentials to localStorage', async () => {
      setFetchResponse(
        new Response(JSON.stringify({ message: 'Connected' }), {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const { result } = renderHook(() => useConnection());

      await act(async () => {
        await result.current.connect(config);
      });

      // Verify nothing was written to localStorage
      expect(localStorage.getItem('connection')).toBeNull();
      expect(localStorage.getItem('credentials')).toBeNull();
      expect(localStorage.getItem('password')).toBeNull();
      expect(localStorage.getItem('connectionConfig')).toBeNull();
      expect(localStorage.getItem('dbConfig')).toBeNull();
      expect(localStorage.length).toBe(0);
    });

    it('does not persist credentials to sessionStorage', async () => {
      setFetchResponse(
        new Response(JSON.stringify({ message: 'Connected' }), {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const { result } = renderHook(() => useConnection());

      await act(async () => {
        await result.current.connect(config);
      });

      expect(sessionStorage.getItem('connection')).toBeNull();
      expect(sessionStorage.getItem('credentials')).toBeNull();
      expect(sessionStorage.getItem('password')).toBeNull();
      expect(sessionStorage.length).toBe(0);
    });

    it('stores credentials in React state only', async () => {
      setFetchResponse(
        new Response(JSON.stringify({ message: 'Connected' }), {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const { result } = renderHook(() => useConnection());

      await act(async () => {
        await result.current.connect(config);
      });

      expect(result.current.config).toEqual(config);
      expect(result.current.config?.password).toBe('s3cret');
    });
  });

  describe('connection success/failure is displayed to user (criterion 3)', () => {
    it('displays success message on successful connection', async () => {
      setFetchResponse(
        new Response(JSON.stringify({ message: 'Connection successful' }), {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const { result } = renderHook(() => useConnection());

      await act(async () => {
        await result.current.connect(config);
      });

      expect(result.current.status).toBe('connected');
      expect(result.current.message).toBe('Connection successful');
      expect(result.current.error).toBeNull();
    });

    it('displays error message on failed connection', async () => {
      setFetchResponse(
        new Response(JSON.stringify({ message: 'Invalid credentials' }), {
          status: 401,
          statusText: 'Unauthorized',
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const { result } = renderHook(() => useConnection());

      await act(async () => {
        await result.current.connect(config);
      });

      expect(result.current.status).toBe('error');
      expect(result.current.error).toBe('Invalid credentials');
      expect(result.current.message).toBeNull();
    });

    it('displays error message on network failure', async () => {
      setFetchError(new TypeError('Failed to fetch'));

      const { result } = renderHook(() => useConnection());

      await act(async () => {
        await result.current.connect(config);
      });

      expect(result.current.status).toBe('error');
      expect(result.current.error).toBe('Failed to fetch');
      expect(result.current.message).toBeNull();
    });

    it('clears messages with clearMessage()', async () => {
      setFetchResponse(
        new Response(JSON.stringify({ message: 'Connected' }), {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const { result } = renderHook(() => useConnection());

      await act(async () => {
        await result.current.connect(config);
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

  describe('EMPTY_CONFIG export', () => {
    it('provides an empty connection config with default port', () => {
      expect(EMPTY_CONFIG).toEqual({
        host: '',
        port: 5432,
        database: '',
        user: '',
        password: '',
      });
    });
  });
});
