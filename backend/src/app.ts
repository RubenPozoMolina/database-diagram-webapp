/**
 * Express application for the database diagram backend.
 *
 * Exposes the minimal PostgreSQL API surface: test connection, read schema,
 * apply schema (TASK-067). Only the test-connection route is implemented in
 * this ticket.
 */

import express from 'express';
import { testConnectionHandler } from './routes/test-connection';
import { errorHandler } from './middleware/error-handler';

const app = express();

app.use(express.json());

// Health check (useful for container readiness probes).
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.post('/api/v1/connections/test', testConnectionHandler);

// 404 for unknown routes.
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Not found.' });
});

// Centralised error handler (must be last).
app.use(errorHandler);

export { app };
