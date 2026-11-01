/**
 * POST /api/v1/connections/test route handler.
 *
 * Validates the request body, delegates to the connection test service, and
 * returns the HTTP status code and body defined by the TASK-051 API
 * specification (§3).
 */

import type { Request, Response } from 'express';
import { testConnection } from '../services/connection-test.service';
import { validateTestConnectionRequest } from '../middleware/validation';
import type { TestConnectionRequest } from '../types/connection';

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
