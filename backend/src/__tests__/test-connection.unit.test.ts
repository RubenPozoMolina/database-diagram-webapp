/**
 * Unit tests for the test-connection endpoint and related services.
 *
 * The pg.Client is mocked so no real database is required. These tests cover:
 *   - Successful connection (200)
 *   - Invalid credentials (401)
 *   - Connection refused / unreachable server (502)
 *   - Connection timeout (504)
 *   - Validation errors (400)
 *   - Unexpected errors (500)
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';

// ---------------------------------------------------------------------------
// Mock pg.Client. The factory returns the mock functions as named exports so
// tests can control their behaviour per test case. vi.mock is hoisted by
// vitest, so the mocks are created inside the factory to avoid temporal
// dead-zone issues with const declarations.
// ---------------------------------------------------------------------------

vi.mock('pg', () => {
  const connectMock = vi.fn().mockResolvedValue(undefined);
  const endMock = vi.fn().mockResolvedValue(undefined);
  return {
    Client: vi.fn().mockImplementation(() => ({
      connect: connectMock,
      end: endMock,
    })),
    connectMock,
    endMock,
  };
});

// vi.mock adds connectMock and endMock as named exports of the 'pg' module.
// TypeScript does not know about them, so we declare them here.
declare module 'pg' {
  export const connectMock: Mock;
  export const endMock: Mock;
}

import { connectMock, endMock } from 'pg';
import { PostgresConnectionService } from '../services/postgres-connection.service';
import { validateConnectionParams } from '../middleware/validate';

describe('validateConnectionParams', () => {
  it('returns valid for a complete request body', () => {
    const result = validateConnectionParams({
      host: 'localhost',
      port: 5432,
      database: 'mydb',
      user: 'app_user',
      password: 's3cr3t',
    });
    expect(result.valid).toBe(true);
  });

  it('returns invalid for missing host', () => {
    const result = validateConnectionParams({
      port: 5432,
      database: 'mydb',
      user: 'app_user',
      password: 's3cr3t',
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('host');
  });

  it('returns invalid for missing port', () => {
    const result = validateConnectionParams({
      host: 'localhost',
      database: 'mydb',
      user: 'app_user',
      password: 's3cr3t',
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('port');
  });

  it('returns invalid for port out of range', () => {
    const result = validateConnectionParams({
      host: 'localhost',
      port: 0,
      database: 'mydb',
      user: 'app_user',
      password: 's3cr3t',
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('port');

    const result2 = validateConnectionParams({
      host: 'localhost',
      port: 65536,
      database: 'mydb',
      user: 'app_user',
      password: 's3cr3t',
    });
    expect(result2.valid).toBe(false);
    expect(result2.error).toContain('port');
  });

  it('returns invalid for missing database', () => {
    const result = validateConnectionParams({
      host: 'localhost',
      port: 5432,
      user: 'app_user',
      password: 's3cr3t',
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('database');
  });

  it('returns invalid for missing user', () => {
    const result = validateConnectionParams({
      host: 'localhost',
      port: 5432,
      database: 'mydb',
      password: 's3cr3t',
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('user');
  });

  it('returns invalid for missing password', () => {
    const result = validateConnectionParams({
      host: 'localhost',
      port: 5432,
      database: 'mydb',
      user: 'app_user',
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('password');
  });

  it('returns invalid for empty body', () => {
    const result = validateConnectionParams(null);
    expect(result.valid).toBe(false);

    const result2 = validateConnectionParams({});
    expect(result2.valid).toBe(false);
  });
});

describe('PostgresConnectionService', () => {
  let service: PostgresConnectionService;

  beforeEach(() => {
    service = new PostgresConnectionService(10_000);
    vi.clearAllMocks();
    connectMock.mockResolvedValue(undefined);
    endMock.mockResolvedValue(undefined);
  });

  it('returns success when connect resolves', async () => {
    const result = await service.testConnection({
      host: 'localhost',
      port: 5432,
      database: 'mydb',
      user: 'app_user',
      password: 's3cr3t',
    });

    expect(result.success).toBe(true);
    expect(result.message).toBe('Connection to PostgreSQL established successfully.');
    expect(connectMock).toHaveBeenCalledTimes(1);
    expect(endMock).toHaveBeenCalledTimes(1);
  });

  it('closes the client on success', async () => {
    await service.testConnection({
      host: 'localhost',
      port: 5432,
      database: 'mydb',
      user: 'app_user',
      password: 's3cr3t',
    });

    expect(endMock).toHaveBeenCalledTimes(1);
  });

  it('returns 401 for authentication failure (SQLSTATE 28P01)', async () => {
    connectMock.mockRejectedValue({ code: '28P01', message: 'password authentication failed for user "app_user"' });

    const result = await service.testConnection({
      host: 'localhost',
      port: 5432,
      database: 'mydb',
      user: 'app_user',
      password: 'wrong',
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(401);
    expect(result.error).toContain('Authentication failed');
    expect(result.error).not.toContain('wrong');
    expect(result.error).not.toContain('s3cr3t');
  });

  it('returns 401 for authentication failure (SQLSTATE 28000)', async () => {
    connectMock.mockRejectedValue({ code: '28000', message: 'invalid authorization specification' });

    const result = await service.testConnection({
      host: 'localhost',
      port: 5432,
      database: 'mydb',
      user: 'app_user',
      password: 'wrong',
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(401);
  });

  it('returns 401 when message contains "authentication failed"', async () => {
    connectMock.mockRejectedValue({ code: '28P01', message: 'Authentication failed for user "app_user"' });

    const result = await service.testConnection({
      host: 'localhost',
      port: 5432,
      database: 'mydb',
      user: 'app_user',
      password: 'wrong',
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(401);
  });

  it('returns 502 for connection refused (ECONNREFUSED)', async () => {
    connectMock.mockRejectedValue({
      code: 'ECONNREFUSED',
      message: 'connect ECONNREFUSED 127.0.0.1:5432',
    });

    const result = await service.testConnection({
      host: 'localhost',
      port: 5432,
      database: 'mydb',
      user: 'app_user',
      password: 's3cr3t',
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(502);
    expect(result.error).toContain('Unable to reach PostgreSQL server');
  });

  it('returns 502 for DNS resolution failure (ENOTFOUND)', async () => {
    connectMock.mockRejectedValue({
      code: 'ENOTFOUND',
      message: 'getaddrinfo ENOTFOUND nonexistent.invalid',
    });

    const result = await service.testConnection({
      host: 'nonexistent.invalid',
      port: 5432,
      database: 'mydb',
      user: 'app_user',
      password: 's3cr3t',
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(502);
  });

  it('returns 504 for connection timeout', async () => {
    connectMock.mockRejectedValue({
      code: 'ETIMEDOUT',
      message: 'connect ETIMEDOUT 10.0.0.1:5432',
    });

    const result = await service.testConnection({
      host: '10.0.0.1',
      port: 5432,
      database: 'mydb',
      user: 'app_user',
      password: 's3cr3t',
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(504);
    expect(result.error).toContain('timed out');
  });

  it('returns 500 for unexpected errors', async () => {
    connectMock.mockRejectedValue(new Error('Something unexpected'));

    const result = await service.testConnection({
      host: 'localhost',
      port: 5432,
      database: 'mydb',
      user: 'app_user',
      password: 's3cr3t',
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(500);
    expect(result.error).toBe('Internal server error while testing connection.');
  });

  it('closes the client even when connect fails', async () => {
    connectMock.mockRejectedValue({ code: 'ECONNREFUSED', message: 'refused' });

    await service.testConnection({
      host: 'localhost',
      port: 5432,
      database: 'mydb',
      user: 'app_user',
      password: 's3cr3t',
    });

    expect(endMock).toHaveBeenCalledTimes(1);
  });
});

describe('POST /api/v1/connections/test', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    app = createApp();
    vi.clearAllMocks();
    connectMock.mockResolvedValue(undefined);
    endMock.mockResolvedValue(undefined);
  });

  it('returns 200 with success when connection succeeds', async () => {
    const res = await request(app)
      .post('/api/v1/connections/test')
      .send({
        host: 'localhost',
        port: 5432,
        database: 'mydb',
        user: 'app_user',
        password: 's3cr3t',
      })
      .expect('Content-Type', /json/);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Connection to PostgreSQL established successfully.');
  });

  it('returns 400 for missing required field', async () => {
    const res = await request(app)
      .post('/api/v1/connections/test')
      .send({ host: 'localhost', port: 5432, database: 'mydb', user: 'app_user' })
      .expect('Content-Type', /json/);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('password');
  });

  it('returns 400 for invalid port', async () => {
    const res = await request(app)
      .post('/api/v1/connections/test')
      .send({
        host: 'localhost',
        port: 99999,
        database: 'mydb',
        user: 'app_user',
        password: 's3cr3t',
      })
      .expect('Content-Type', /json/);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('port');
  });

  it('returns 401 for authentication failure', async () => {
    connectMock.mockRejectedValue({
      code: '28P01',
      message: 'password authentication failed for user "app_user"',
    });

    const res = await request(app)
      .post('/api/v1/connections/test')
      .send({
        host: 'localhost',
        port: 5432,
        database: 'mydb',
        user: 'app_user',
        password: 'wrong',
      })
      .expect('Content-Type', /json/);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('Authentication failed');
    expect(res.body.error).not.toContain('wrong');
  });

  it('returns 502 for connection refused', async () => {
    connectMock.mockRejectedValue({
      code: 'ECONNREFUSED',
      message: 'connect ECONNREFUSED 127.0.0.1:5432',
    });

    const res = await request(app)
      .post('/api/v1/connections/test')
      .send({
        host: 'localhost',
        port: 5432,
        database: 'mydb',
        user: 'app_user',
        password: 's3cr3t',
      })
      .expect('Content-Type', /json/);

    expect(res.status).toBe(502);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('Unable to reach PostgreSQL server');
  });

  it('returns 504 for connection timeout', async () => {
    connectMock.mockRejectedValue({
      code: 'ETIMEDOUT',
      message: 'connect ETIMEDOUT 10.0.0.1:5432',
    });

    const res = await request(app)
      .post('/api/v1/connections/test')
      .send({
        host: '10.0.0.1',
        port: 5432,
        database: 'mydb',
        user: 'app_user',
        password: 's3cr3t',
      })
      .expect('Content-Type', /json/);

    expect(res.status).toBe(504);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('timed out');
  });

  it('never includes the password in the response', async () => {
    connectMock.mockRejectedValue({
      code: '28P01',
      message: 'password authentication failed for user "app_user"',
    });

    const res = await request(app)
      .post('/api/v1/connections/test')
      .send({
        host: 'localhost',
        port: 5432,
        database: 'mydb',
        user: 'app_user',
        password: 'super-secret-password-123',
      })
      .expect('Content-Type', /json/);

    const body = JSON.stringify(res.body);
    expect(body).not.toContain('super-secret-password-123');
  });
});
