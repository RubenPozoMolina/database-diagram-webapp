/**
 * Express application factory for the database diagram backend.
 *
 * Creates and configures the Express app with security middleware, JSON body
 * parsing, and all routes:
 * - POST /api/v1/connections/test  (TASK-052 / STORY-016: service-based handler)
 * - POST /api/test-connection      (trunk: router-based handler)
 * - POST /api/read-schema          (trunk: schema introspection)
 * - POST /api/apply-schema         (trunk: schema application)
 * - GET  /health
 *
 * Does not start the server; the entry point (src/index.ts) handles listening.
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { testConnectionHandler } from './routes/test-connection';
import { testConnectionRouter } from './routes/test-connection';
import { readSchemaRouter } from './routes/read-schema';
import { applySchemaRouter } from './routes/apply-schema';
import { errorHandler } from './middleware/error-handler';

function configureApp(app: express.Application): express.Application {
  // Security headers.
  app.use(helmet());

  // CORS for cross-origin frontend access.
  app.use(cors());

  // JSON body parser.
  app.use(express.json());

  // Health check (useful for container readiness probes).
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  // Routes.
  app.post('/api/v1/connections/test', testConnectionHandler);
  app.use('/api/test-connection', testConnectionRouter);
  app.use('/api/read-schema', readSchemaRouter);
  app.use('/api/apply-schema', applySchemaRouter);

  // 404 for unknown routes.
  app.use((_req, res) => {
    res.status(404).json({ success: false, error: 'Not found.' });
  });

  // Centralised error handler (must be last).
  app.use(errorHandler);

  return app;
}

export const app = configureApp(express());

export function createApp(): express.Application {
  return configureApp(express());
}
