/**
 * Application entry point.
 *
 * Creates the Express app with security middleware, JSON body parsing and all
 * routes (test-connection, read-schema, apply-schema, health), then starts
 * listening on the configured port. Does not listen when NODE_ENV is 'test'
 * (used by Vitest).
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { testConnectionHandler, testConnectionRouter } from './routes/test-connection';
import { readSchemaRouter } from './routes/read-schema';
import { applySchemaRouter } from './routes/apply-schema';

const app = express();

// Security headers.
app.use(helmet());

// CORS for cross-origin frontend access.
app.use(cors());

// JSON body parser.
app.use(express.json());

// Routes (test-connection from STORY-016 plus routes contributed by other tickets).
app.post('/api/v1/connections/test', testConnectionHandler);
app.use('/api/test-connection', testConnectionRouter);
app.use('/api/read-schema', readSchemaRouter);
app.use('/api/apply-schema', applySchemaRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// 404 handler.
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Not found.' });
});

// Centralised error handler. Never leaks stack traces or internals to the client.
app.use(
  (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({
      success: false,
      error: 'Internal server error.',
    });
  }
);

const PORT = Number(process.env.PORT) || 3001;

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Backend server listening on port ${PORT}`);
  });
}

export default app;
export { createApp } from './app';
