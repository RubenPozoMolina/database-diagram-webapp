/**
 * useConnection - React hook for PostgreSQL connection state management.
 *
 * Holds connection credentials only in memory for the current session.
 * Credentials are never persisted to localStorage, sessionStorage, or any
 * durable storage. When the component unmounts, credentials are cleared.
 *
 * Connection state tracks connected/disconnected status and exposes
 * success/failure messages for display to the user.
 *
 * Usage:
 *   const { status, config, error, connect, disconnect, isConnected } =
 *     useConnection();
 */

import { useCallback, useRef, useState } from 'react';
import type { ConnectionConfig, ConnectionResult } from '../types';
import { submitConnection } from '../connection/connectionApi';

export interface UseConnectionReturn {
  /** Current connection status: 'disconnected' | 'connecting' | 'connected' | 'error' */
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  /** Whether a connection is currently established */
  isConnected: boolean;
  /** The connection config held in memory (password included, never persisted) */
  config: ConnectionConfig | null;
  /** Error message when connection failed, null otherwise */
  error: string | null;
  /** Success message when connection succeeded, null otherwise */
  message: string | null;
  /**
   * Attempts to connect to PostgreSQL with the given config.
   * Credentials are held in memory only for the current session.
   */
  connect: (config: ConnectionConfig) => Promise<void>;
  /** Disconnects and clears credentials from memory */
  disconnect: () => void;
  /** Clears any error or success message */
  clearMessage: () => void;
}

const EMPTY_CONFIG: ConnectionConfig = {
  host: '',
  port: 5432,
  database: '',
  user: '',
  password: '',
};

/**
 * Custom hook managing PostgreSQL connection state in memory.
 *
 * Credentials live only in component state (React's in-memory store) and
 * are never written to localStorage, sessionStorage, IndexedDB, cookies,
 * or any other durable browser storage. On unmount, credentials are wiped.
 */
export function useConnection(): UseConnectionReturn {
  const [status, setStatus] = useState<
    'disconnected' | 'connecting' | 'connected' | 'error'
  >('disconnected');
  const [config, setConfig] = useState<ConnectionConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Ref to hold the API submit function so we can swap it in tests.
  const apiSubmitRef = useRef<(config: ConnectionConfig) => Promise<ConnectionResult>>(
    submitConnection,
  );

  const connect = useCallback(
    async (connectionConfig: ConnectionConfig): Promise<void> => {
      setStatus('connecting');
      setError(null);
      setMessage(null);

      // Store credentials in memory only (React state, never persisted).
      setConfig(connectionConfig);

      try {
        const result: ConnectionResult = await apiSubmitRef.current(
          connectionConfig,
        );

        if (result.success) {
          setStatus('connected');
          setMessage(result.message ?? 'Connection established');
          setError(null);
        } else {
          setStatus('error');
          setError(result.error ?? 'Connection failed');
          setMessage(null);
          // Credentials remain in memory but connection is not established;
          // user can retry without re-entering.
        }
      } catch (err) {
        setStatus('error');
        setError(
          err instanceof Error ? err.message : 'Unexpected connection error',
        );
        setMessage(null);
      }
    },
    [],
  );

  const disconnect = useCallback((): void => {
    setStatus('disconnected');
    setConfig(null);
    setError(null);
    setMessage(null);
  }, []);

  const clearMessage = useCallback((): void => {
    setError(null);
    setMessage(null);
  }, []);

  return {
    status,
    isConnected: status === 'connected',
    config,
    error,
    message,
    connect,
    disconnect,
    clearMessage,
  };
}

export { EMPTY_CONFIG };
