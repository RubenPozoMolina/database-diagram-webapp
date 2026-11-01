/**
 * Route handlers for testing a PostgreSQL connection.
 *
 * Two implementations coexist:
 * - testConnectionHandler (TASK-052 / STORY-016): service-based handler used by
 *   configureApp() at POST /api/v1/connections/test. Validates input, attempts a
 *   real PostgreSQL connection via pg.Client, returns 200/400/401/502/504/500
 *   and never leaks the password.
 * - testConnectionRouter (trunk): Express Router at POST /api/test-connection
 *   that validates with zod and reports the server version.
 */

import type { Request, Response } from 'express';
import { Router, type RequestHandler } from 'express';
import { testConnection } from '../services/connection-test.service';
import { validateTestConnectionRequest } from '../middleware/validation';
import type { TestConnectionRequest } from '../types/connection';
import { TestConnectionRequestSchema, type TestConnectionResult } from '../types/test-connection';

// ---------------------------------------------------------------------------
// TASK-052 / STORY-016: service-based handler at POST /api/v1/connections/test
// ---------------------------------------------------------------------------

export async function testConnectionHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const body = req.body as TestConnectionRequest;

    const validationError = validateTestConnectionRequest(body);
    if (validationError) {
      res.status(400).json({ success: false, error: validationError });
      return;
    }

    const result = await testConnection(body);

    if (result.success) {
      res.status(200).json({
        success: true,
        message: result.message,
      });
      return;
    }

    res.status(result.statusCode ?? 500).json({
      success: false,
      error: result.error,
    });
  } catch {
    res.status(500).json({
      success: false,
      error: 'Unable to test the connection. Please try again later.',
    });
  }
}

// ---------------------------------------------------------------------------
// Trunk: router-based implementation (preserved) at POST /api/test-connection
// ---------------------------------------------------------------------------

export const testConnectionRouter = Router();

const handleTestConnection: RequestHandler = async (req, res) => {
  const parseResult = TestConnectionRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Invalid request', issues: parseResult.error.issues });
    return;
  }

  const { host, port, database, user, password } = parseResult.data;

  try {
    const { Client } = await import('pg');
    const client = new Client({
      host,
      port,
      database,
      user,
      password,
      connectionTimeoutMillis: 5000,
    });

    await client.connect();
    const versionResult = await client.query('SELECT version()');
    await client.end();

    const result: TestConnectionResult = {
      success: true,
      message: 'Connection successful',
      serverVersion: versionResult.rows[0]?.version,
    };

    res.json(result);
  } catch (err) {
    const result: TestConnectionResult = {
      success: false,
      message: err instanceof Error ? err.message : 'Unknown error',
    };
    res.status(400).json(result);
  }
};

testConnectionRouter.post('/', handleTestConnection);
