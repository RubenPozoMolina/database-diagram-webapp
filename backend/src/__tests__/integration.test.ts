/**
 * Integration tests for the test-connection endpoint against a real
 * PostgreSQL instance.
 *
 * These tests require a running PostgreSQL server. Connection parameters are
 * read from environment variables:
 *   PG_HOST, PG_PORT, PG_DATABASE, PG_USER, PG_PASSWORD  (valid credentials)
 *   PG_BAD_PASSWORD                                       (invalid password)
 *   PG_BAD_HOST                                           (unreachable host)
 *
 * They are intended to run inside Docker against a throwaway postgres:16
 * container on a private network (see docker-test-runner skill).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';

function env(name: string): string | undefined {
  return process.env[name];
}

const VALID = {
  host: env('PG_HOST') ?? 'localhost',
  port: env('PG_PORT') ? Number(env('PG_PORT')) : 5432,
  database: env('PG_DATABASE') ?? 'postgres',
  user: env('PG_USER') ?? 'postgres',
  password: env('PG_PASSWORD') ?? '',
};

const INVALID_PASSWORD = env('PG_BAD_PASSWORD') ?? 'wrong-password';
const UNREACHABLE_HOST = env('PG_BAD_HOST') ?? '10.255.255.1';

describe('POST /api/v1/connections/test (integration)', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    app = createApp();
  });

  afterEach(() => {
    // No cleanup needed; each request opens and closes its own connection.
  });

  it('returns 200 for valid credentials', async () => {
    const res = await request(app)
      .post('/api/v1/connections/test')
      .send(VALID)
      .expect('Content-Type', /json/);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Connection to PostgreSQL established successfully.');
  });

  it('returns 401 for invalid password', async () => {
    const res = await request(app)
      .post('/api/v1/connections/test')
      .send({ ...VALID, password: INVALID_PASSWORD })
      .expect('Content-Type', /json/);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('Authentication failed');
    // Password must not be echoed back.
    expect(JSON.stringify(res.body)).not.toContain(INVALID_PASSWORD);
    expect(JSON.stringify(res.body)).not.toContain(VALID.password);
  });

  it('returns a 5xx server error for unreachable host', async () => {
    // This test takes longer because the OS TCP timeout must elapse
    // before pg reports the connection failure. An unreachable host
    // may surface as 502 (network unreachable) or 504 (connection
    // timeout) depending on how the network drops packets.
    const res = await request(app)
      .post('/api/v1/connections/test')
      .send({ ...VALID, host: UNREACHABLE_HOST })
      .expect('Content-Type', /json/);

    expect(res.status).toBeGreaterThanOrEqual(500);
    expect(res.status).toBeLessThan(600);
    expect(res.body.success).toBe(false);
    // Network failures surface as either 502 (network unreachable) or
    // 504 (connection timeout), both with descriptive messages.
    expect(res.body.error).toMatch(
      /Unable to reach PostgreSQL server|timed out/
    );
  }, 15000);

  it('returns 400 for missing required field', async () => {
    const { password: _unusedPassword, ...withoutPassword } = VALID;
    void _unusedPassword;
    const res = await request(app)
      .post('/api/v1/connections/test')
      .send(withoutPassword)
      .expect('Content-Type', /json/);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('password');
  });
});
