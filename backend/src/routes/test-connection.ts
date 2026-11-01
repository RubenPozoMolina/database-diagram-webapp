/**
 * Route handlers for testing a PostgreSQL connection.
 *
 * Two implementations coexist:
 * - testConnectionHandler (STORY-016): service-based handler used by
 *   createApp() at POST /api/v1/connections/test. Validates input, attempts a
 *   real PostgreSQL connection via pg.Client, returns 200/400/401/502/504/500
 *   and never leaks the password.
 * - testConnectionRouter (trunk): Express Router at POST /api/test-connection
 *   that validates with zod and reports the server version.
 */

import type { Request, Response } from 'express';
import { Router, RequestHandler } from 'express';
import { validateConnectionParams } from '../middleware/validate';
import { PostgresConnectionService } from '../services/postgres-connection.service';
import type { ConnectionParams } from '../types';
import { TestConnectionRequestSchema, type TestConnectionResult } from '../types/test-connection';

// ---------------------------------------------------------------------------
// STORY-016: service-based handler
// ---------------------------------------------------------------------------

const service = new PostgresConnectionService();

export function testConnectionHandler(req: Request, res: Response): void {
  const validation = validateConnectionParams(req.body);
  if (!validation.valid) {
    res.status(400).json({
      success: false,
      error: `Validation error: ${validation.error}`,
    });
    return;
  }

  const params = req.body as unknown as ConnectionParams;

  service
    .testConnection(params)
    .then((result) => {
      if (result.success) {
        res.status(200).json({ success: true, message: result.message });
      } else {
        res.status(result.statusCode ?? 500).json({
          success: false,
          error: result.error,
        });
      }
    })
    .catch(() => {
      res.status(500).json({
        success: false,
        error: 'Internal server error while testing connection.',
      });
    });
}

// ---------------------------------------------------------------------------
// Trunk: router-based implementation (preserved)
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
