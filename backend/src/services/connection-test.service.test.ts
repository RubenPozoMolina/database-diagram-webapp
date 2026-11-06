/**
 * Unit tests for the connection test service.
 *
 * The `pg` Client is mocked so these tests run without a live PostgreSQL
 * server. Each case verifies that the service categorises failures into the
 * correct HTTP status code and never leaks the password.
 *
 * Mocks are created inside each test (not referenced from a `vi.mock`
 * factory) to avoid vitest hoisting/temporal-dead-zone issues.
 */

import { Client } from 'pg';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { testConnection } from './connection-test.service';

vi.mock('pg', () => ({
  Client: vi.fn(),
}));

const params = {
  host: 'localhost',
  port: 5432,
  database: 'mydb',
  user: 'app_user',
  password: 's3cr3t',
};

function mockClient(
  connectImpl: () => Promise<unknown>,
  queryImpl: () => Promise<unknown> = async () => ({
    rows: [{ server_version_num: '160000' }],
  }),
): void {
  const connect = vi.fn(connectImpl);
  const query = vi.fn(queryImpl);
  const end = vi.fn().mockResolvedValue(undefined);
  vi.mocked(Client).mockImplementation(() => ({
    connect,
    query,
    end,
  } as unknown as Client));
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('testConnection', () => {
  it('returns success when the connection is established', async () => {
    mockClient(() => Promise.resolve(undefined));

    const result = await testConnection(params, 10_000);

    expect(result.success).toBe(true);
    expect(result.message).toBe(
      'Connection to PostgreSQL established successfully.',
    );
  });

  it('closes the connection after a successful test', async () => {
    const end = vi.fn().mockResolvedValue(undefined);
    const connect = vi.fn().mockResolvedValue(undefined);
    vi.mocked(Client).mockImplementation(() => ({
      connect,
      end,
    } as unknown as Client));

    await testConnection(params, 10_000);

    expect(end).toHaveBeenCalled();
  });

  it('returns 401 for invalid credentials without leaking the password', async () => {
    const err: Error & { code?: string } = new Error(
      'password authentication failed for user "app_user"',
    );
    err.code = '28P01';
    mockClient(() => Promise.reject(err));

    const result = await testConnection(params, 10_000);

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(401);
    expect(result.error).toContain('Authentication failed');
    expect(result.error).not.toContain('s3cr3t');
  });

  it('returns 401 for an unknown user', async () => {
    const err: Error & { code?: string } = new Error(
      'role "nonexistent_user" does not exist',
    );
    err.code = '28000';
    mockClient(() => Promise.reject(err));

    const result = await testConnection(params, 10_000);

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(401);
  });

  it('returns 502 when the server is unreachable (connection refused)', async () => {
    const err: Error & { code?: string } = new Error(
      'connect ECONNREFUSED localhost:5432',
    );
    err.code = 'ECONNREFUSED';
    mockClient(() => Promise.reject(err));

    const result = await testConnection(params, 10_000);

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(502);
    expect(result.error).toContain('Unable to reach PostgreSQL server');
    expect(result.error).toContain('localhost:5432');
  });

  it('returns 502 when DNS resolution fails', async () => {
    const err: Error & { code?: string } = new Error(
      'getaddrinfo ENOTFOUND nonexistent.host',
    );
    err.code = 'ENOTFOUND';
    mockClient(() => Promise.reject(err));

    const result = await testConnection(params, 10_000);

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(502);
  });

  it('returns 504 when the connection attempt times out', async () => {
    // connect never resolves; the service-side timeout fires.
    mockClient(() => new Promise(() => {}));

    const result = await testConnection(params, 100);

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(504);
    expect(result.error).toContain('timed out after');
  });

  it('returns 500 for unexpected errors without leaking internals', async () => {
    const err = new Error('Unexpected driver failure');
    mockClient(() => Promise.reject(err));

    const result = await testConnection(params, 10_000);

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(500);
    expect(result.error).toBe(
      'Unable to test the connection. Please try again later.',
    );
    expect(result.error).not.toContain('stack');
    expect(result.error).not.toContain('Unexpected driver failure');
  });

  it('returns 401 for insufficient privileges (SQLSTATE 42501) without leaking the password', async () => {
    const err: Error & { code?: string } = new Error(
      'permission denied for database "mydb"',
    );
    err.code = '42501';
    mockClient(() => Promise.reject(err));

    const result = await testConnection(params, 10_000);

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(401);
    expect(result.error).toContain('Authentication failed');
    expect(result.error).not.toContain('s3cr3t');
  });

  it('returns 400 when the PostgreSQL version is below 14', async () => {
    mockClient(() => Promise.resolve(undefined), async () => ({
      rows: [{ server_version_num: '130000' }],
    }));

    const result = await testConnection(params, 10_000);

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(400);
    expect(result.error).toContain('Unsupported PostgreSQL version');
    expect(result.error).toContain('14 or later');
    expect(result.error).not.toContain('s3cr3t');
  });

  it('returns success when the server version is 14 or newer and queries the version', async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [{ server_version_num: '160000' }],
    });
    const connect = vi.fn().mockResolvedValue(undefined);
    const end = vi.fn().mockResolvedValue(undefined);
    vi.mocked(Client).mockImplementation(() => ({
      connect,
      query,
      end,
    } as unknown as Client));

    const result = await testConnection(params, 10_000);

    expect(result.success).toBe(true);
    expect(query).toHaveBeenCalledTimes(1);
    expect(end).toHaveBeenCalledTimes(1);
  });
});
