/**
 * HTTP route tests for POST /api/v1/connections/test.
 *
 * The connection test service is mocked so these tests exercise the request
 * validation, status-code mapping, and response shape defined by the TASK-051
 * API specification without requiring a live PostgreSQL server.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';
import { app } from '../app';

vi.mock('../services/connection-test.service', () => ({
  testConnection: vi.fn(),
}));

import { testConnection } from '../services/connection-test.service';

const mockTestConnection = vi.mocked(testConnection);

const baseUrl = '/api/v1/connections/test';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/v1/connections/test', () => {
  it('returns 200 with success when credentials are valid', async () => {
    mockTestConnection.mockResolvedValue({
      success: true,
      message: 'Connection to PostgreSQL established successfully.',
    });

    const res = await supertest(app)
      .post(baseUrl)
      .send({
        host: 'localhost',
        port: 5432,
        database: 'mydb',
        user: 'app_user',
        password: 's3cr3t',
      })
      .expect('Content-Type', /json/)
      .expect(200);

    expect(res.body).toEqual({
      success: true,
      message: 'Connection to PostgreSQL established successfully.',
    });
  });

  it('returns 400 when a required field is missing', async () => {
    const res = await supertest(app)
      .post(baseUrl)
      .send({
        host: 'localhost',
        port: 5432,
        database: 'mydb',
        user: 'app_user',
        // password missing
      })
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('password');
    // No connection attempt should be made for invalid requests.
    expect(mockTestConnection).not.toHaveBeenCalled();
  });

  it('returns 400 when the port is out of range', async () => {
    const res = await supertest(app)
      .post(baseUrl)
      .send({
        host: 'localhost',
        port: 99999,
        database: 'mydb',
        user: 'app_user',
        password: 's3cr3t',
      })
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('port');
    expect(mockTestConnection).not.toHaveBeenCalled();
  });

  it('returns 400 when the body is not a JSON object', async () => {
    const res = await supertest(app)
      .post(baseUrl)
      .send('not json')
      .set('Content-Type', 'application/json')
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(mockTestConnection).not.toHaveBeenCalled();
  });

  it('returns 401 when the service reports invalid credentials', async () => {
    mockTestConnection.mockResolvedValue({
      success: false,
      error: 'Authentication failed: password authentication failed for user "app_user".',
      statusCode: 401,
    });

    const res = await supertest(app)
      .post(baseUrl)
      .send({
        host: 'localhost',
        port: 5432,
        database: 'mydb',
        user: 'app_user',
        password: 'wrong',
      })
      .expect(401);

    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('Authentication failed');
  });

  it('returns 502 when the database server is unreachable', async () => {
    mockTestConnection.mockResolvedValue({
      success: false,
      error: 'Unable to reach PostgreSQL server at localhost:5432: connection refused.',
      statusCode: 502,
    });

    const res = await supertest(app)
      .post(baseUrl)
      .send({
        host: 'localhost',
        port: 5432,
        database: 'mydb',
        user: 'app_user',
        password: 's3cr3t',
      })
      .expect(502);

    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('Unable to reach PostgreSQL server');
  });

  it('returns 504 when the connection attempt times out', async () => {
    mockTestConnection.mockResolvedValue({
      success: false,
      error: 'Connection attempt timed out after 10 seconds.',
      statusCode: 504,
    });

    const res = await supertest(app)
      .post(baseUrl)
      .send({
        host: 'localhost',
        port: 5432,
        database: 'mydb',
        user: 'app_user',
        password: 's3cr3t',
      })
      .expect(504);

    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('timed out');
  });

  it('returns 500 when the service throws unexpectedly', async () => {
    mockTestConnection.mockRejectedValue(new Error('boom'));

    const res = await supertest(app)
      .post(baseUrl)
      .send({
        host: 'localhost',
        port: 5432,
        database: 'mydb',
        user: 'app_user',
        password: 's3cr3t',
      })
      .expect(500);

    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe(
      'Unable to test the connection. Please try again later.',
    );
  });

  it('never includes the password in the response body', async () => {
    mockTestConnection.mockResolvedValue({
      success: false,
      error: 'Authentication failed: password authentication failed for user "app_user".',
      statusCode: 401,
    });

    const res = await supertest(app)
      .post(baseUrl)
      .send({
        host: 'localhost',
        port: 5432,
        database: 'mydb',
        user: 'app_user',
        password: 'super-secret-pw',
      })
      .expect(401);

    const body = JSON.stringify(res.body);
    expect(body).not.toContain('super-secret-pw');
  });
});
