/**
 * Route handler for POST /api/v1/connections/test.
 *
 * Validates the request body, attempts a PostgreSQL connection, and returns
 * success or a descriptive error with the appropriate HTTP status code.
 */

import type { Request, Response } from 'express';
import { validateConnectionParams } from '../middleware/validate';
import { PostgresConnectionService } from '../services/postgres-connection.service';
import type { ConnectionParams } from '../types';

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
        res.status(200).json({
          success: true,
          message: result.message,
        });
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
