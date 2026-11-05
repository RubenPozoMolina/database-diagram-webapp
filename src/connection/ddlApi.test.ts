import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { applyDDL, setFetchForTesting, resetFetchForTesting } from './ddlApi';
import type { ConnectionConfig } from '../types';

const TEST_CONFIG: ConnectionConfig = {
  host: 'localhost',
  port: 5432,
  database: 'app_test',
  user: 'postgres',
  password: 'secret',
  schema: 'public',
};

const TEST_DDL = 'CREATE TABLE "users" ("id" SERIAL NOT NULL PRIMARY KEY);';

describe('applyDDL', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    setFetchForTesting(fetchMock as unknown as typeof fetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetFetchForTesting();
  });

  it('sends DDL with confirm=true to the apply-schema endpoint', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, message: 'OK', ddlPreview: TEST_DDL }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await applyDDL(TEST_DDL, TEST_CONFIG, true);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/apply-schema');
    expect(init!.method).toBe('POST');
    expect(init!.headers['Content-Type']).toBe('application/json');
    const body = JSON.parse(init!.body as string);
    expect(body.ddl).toBe(TEST_DDL);
    expect(body.confirm).toBe(true);
    expect(body.host).toBe('localhost');
    expect(body.schema).toBe('public');
    expect(result.success).toBe(true);
    expect(result.message).toBe('OK');
  });

  it('sends confirm=false when user has not confirmed', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: false,
          error: 'Confirmation required',
          message: 'DDL must be explicitly confirmed before execution.',
          ddlPreview: TEST_DDL,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const result = await applyDDL(TEST_DDL, TEST_CONFIG, false);

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init!.body as string);
    expect(body.confirm).toBe(false);
    expect(result.success).toBe(false);
    expect(result.message).toBe(
      'DDL must be explicitly confirmed before execution.',
    );
  });

  it('returns failure on non-ok response', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: 'Rejected', message: 'DROP not allowed' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const result = await applyDDL('DROP TABLE users;', TEST_CONFIG, true);
    expect(result.success).toBe(false);
    expect(result.message).toBe('DROP not allowed');
  });

  it('returns failure on network error', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Network unreachable'));

    const result = await applyDDL(TEST_DDL, TEST_CONFIG, true);
    expect(result.success).toBe(false);
    expect(result.message).toBe('Network unreachable');
  });

  it('uses custom apiUrl when provided', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, message: 'OK', ddlPreview: TEST_DDL }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await applyDDL(TEST_DDL, TEST_CONFIG, true, '/api/custom/apply-schema');
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/custom/apply-schema');
  });
});
