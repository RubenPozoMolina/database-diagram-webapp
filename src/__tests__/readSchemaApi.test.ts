/**
 * Unit tests for the read-schema API client (TASK-058 / STORY-017).
 *
 * Covers successful introspection responses, failed HTTP responses, validation
 * errors, and network errors. The global `fetch` is replaced with a fake
 * implementation for each test.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  readSchema,
  setFetchForTesting,
  resetFetchForTesting,
  type ReadSchemaRequest,
  type ReadSchemaResponse,
} from '../connection/readSchemaApi';
import type { ConnectionConfig } from '../types';

const config: ConnectionConfig = {
  host: 'db.example.com',
  port: 5433,
  database: 'mydb',
  user: 'app_user',
  password: 's3cret',
  schema: 'public',
};

const successResponse: ReadSchemaResponse = {
  success: true,
  schema: 'public',
  tables: [
    {
      name: 'orders',
      columns: [
        {
          name: 'order_id',
          dataType: 'integer',
          isNullable: false,
          columnDefault: null,
          maxLength: null,
          numericPrecision: 32,
          numericScale: 0,
          datetimePrecision: null,
          intervalType: null,
        },
        {
          name: 'customer_id',
          dataType: 'integer',
          isNullable: false,
          columnDefault: null,
          maxLength: null,
          numericPrecision: 32,
          numericScale: 0,
          datetimePrecision: null,
          intervalType: null,
        },
      ],
      primaryKeys: [
        {
          constraintName: 'orders_pkey',
          columns: ['order_id'],
        },
      ],
      foreignKeys: [
        {
          constraintName: 'orders_customer_id_fkey',
          column: 'customer_id',
          foreignTable: 'customers',
          foreignColumn: 'customer_id',
          updateRule: 'CASCADE',
          deleteRule: 'RESTRICT',
        },
      ],
      uniqueConstraints: [
        {
          constraintName: 'orders_order_number_key',
          columns: ['order_number'],
        },
      ],
      indexes: [
        {
          name: 'idx_orders_customer_id',
          columns: ['customer_id'],
          isUnique: false,
          isPrimary: false,
          isValid: true,
          indexType: 'btree',
          definition:
            'CREATE INDEX idx_orders_customer_id ON public.orders USING btree (customer_id)',
        },
        {
          name: 'orders_pkey',
          columns: ['order_id'],
          isUnique: true,
          isPrimary: true,
          isValid: true,
          indexType: 'btree',
          definition:
            'CREATE UNIQUE INDEX orders_pkey ON public.orders USING btree (order_id)',
        },
      ],
    },
  ],
};

function okJson(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    statusText: 'OK',
    headers: { 'Content-Type': 'application/json' },
  });
}

function errorJson(status: number, statusText: string, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('readSchema', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    resetFetchForTesting();
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('POSTs the connection config as JSON to the read-schema endpoint', async () => {
    let capturedUrl = '';
    let capturedInit: RequestInit | undefined;
    let capturedBody: string | undefined;

    globalThis.fetch = vi.fn(async (_url, init) => {
      capturedUrl = String(_url);
      capturedInit = init;
      capturedBody = init?.body as string | undefined;
      return okJson(successResponse) as unknown as Response;
    });
    setFetchForTesting(globalThis.fetch as typeof fetch);

    await readSchema(config);

    expect(capturedUrl).toBe('/api/read-schema');
    expect(capturedInit?.method).toBe('POST');
    expect(capturedInit?.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(capturedBody).toBe(
      JSON.stringify({
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        password: config.password,
        schema: config.schema,
      }),
    );
  });

  it('POSTs the selected schema when a custom schema is provided', async () => {
    let capturedBody: string | undefined;

    globalThis.fetch = vi.fn(async (_url, init) => {
      capturedBody = init?.body as string | undefined;
      return okJson(successResponse) as unknown as Response;
    });
    setFetchForTesting(globalThis.fetch as typeof fetch);

    await readSchema(config, '/api/read-schema', 'information_schema');

    expect(capturedBody).toContain('"schema":"information_schema"');
  });

  it('returns success with structured schema data when the backend responds OK', async () => {
    globalThis.fetch = vi.fn(async () => okJson(successResponse));
    setFetchForTesting(globalThis.fetch as typeof fetch);

    const result = await readSchema(config);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.schema).toBe('public');
      expect(result.tables).toHaveLength(1);
      expect(result.tables[0].name).toBe('orders');
      expect(result.tables[0].columns).toHaveLength(2);
      expect(result.tables[0].columns[0]).toMatchObject({
        name: 'order_id',
        dataType: 'integer',
        isNullable: false,
      });
      expect(result.tables[0].primaryKeys).toHaveLength(1);
      expect(result.tables[0].primaryKeys[0]).toMatchObject({
        constraintName: 'orders_pkey',
        columns: ['order_id'],
      });
      expect(result.tables[0].foreignKeys).toHaveLength(1);
      expect(result.tables[0].foreignKeys[0]).toMatchObject({
        constraintName: 'orders_customer_id_fkey',
        column: 'customer_id',
        foreignTable: 'customers',
        foreignColumn: 'customer_id',
      });
      expect(result.tables[0].uniqueConstraints).toHaveLength(1);
      expect(result.tables[0].indexes).toHaveLength(2);
    }
  });

  it('returns failure when the backend responds with a validation error (400)', async () => {
    globalThis.fetch = vi.fn(async () =>
      errorJson(400, 'Bad Request', {
        success: false,
        error: 'Validation error: field "password" is required.',
      }),
    );
    setFetchForTesting(globalThis.fetch as typeof fetch);

    const result = await readSchema(config);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('password');
    }
  });

  it('returns failure when the backend responds with auth failure (401)', async () => {
    globalThis.fetch = vi.fn(async () =>
      errorJson(401, 'Unauthorized', {
        success: false,
        error: 'Authentication failed: password authentication failed for user "app_user".',
      }),
    );
    setFetchForTesting(globalThis.fetch as typeof fetch);

    const result = await readSchema(config);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Authentication failed');
    }
  });

  it('returns failure when the backend is unreachable (502)', async () => {
    globalThis.fetch = vi.fn(async () =>
      errorJson(502, 'Bad Gateway', {
        success: false,
        error: 'Unable to reach PostgreSQL server at db.example.com:5433: connection refused.',
      }),
    );
    setFetchForTesting(globalThis.fetch as typeof fetch);

    const result = await readSchema(config);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Unable to reach');
    }
  });

  it('returns failure when the introspection times out (504)', async () => {
    globalThis.fetch = vi.fn(async () =>
      errorJson(504, 'Gateway Timeout', {
        success: false,
        error: 'Schema introspection timed out after 30 seconds.',
      }),
    );
    setFetchForTesting(globalThis.fetch as typeof fetch);

    const result = await readSchema(config);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('timed out');
    }
  });

  it('returns failure when the network request fails', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    setFetchForTesting(globalThis.fetch as typeof fetch);

    const result = await readSchema(config);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Failed to fetch');
    }
  });

  it('accepts a custom API URL', async () => {
    let capturedUrl = '';
    globalThis.fetch = vi.fn(async (_url) => {
      capturedUrl = String(_url);
      return okJson(successResponse) as unknown as Response;
    });
    setFetchForTesting(globalThis.fetch as typeof fetch);

    await readSchema(config, 'https://api.example.com/read-schema');

    expect(capturedUrl).toBe('https://api.example.com/read-schema');
  });

  it('does not leak the password in error responses', async () => {
    globalThis.fetch = vi.fn(async () =>
      errorJson(401, 'Unauthorized', {
        success: false,
        error: 'Authentication failed: password authentication failed for user "app_user".',
      }),
    );
    setFetchForTesting(globalThis.fetch as typeof fetch);

    const result = await readSchema(config);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).not.toContain('s3cret');
      expect(result.error).not.toContain(config.password);
    }
  });
});
