/**
 * Express application factory.
 *
 * Creates and configures the Express app with security middleware, JSON body
 * parsing, and the test-connection route. Does not start the server; the
 * entry point (src/index.ts) handles listening.
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { testConnectionHandler } from './routes/test-connection';

export function createApp(): express.Application {
  const app = express();

  // Security headers.
  app.use(helmet());

  // CORS for cross-origin frontend access.
  app.use(cors());

  // JSON body parser.
  app.use(express.json());

  // Routes.
  app.post('/api/v1/connections/test', testConnectionHandler);

  // 404 handler.
  app.use((_req, res) => {
    res.status(404).json({ success: false, error: 'Not found.' });
  });

  // Centralised error handler.
  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      // Never leak stack traces or internals to the client.
      res.status(500).json({
        success: false,
        error: 'Internal server error.',
      });
    }
  );

  return app;
}
