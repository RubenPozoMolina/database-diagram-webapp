/**
 * Centralised error-handling middleware for the backend.
 *
 * Produces a generic 500 response that never leaks stack traces or internals
 * to the client (§4.5 of the API specification). Middleware such as
 * `express.json()` attaches a `status` (e.g. `400` for malformed JSON) to the
 * error it passes down; that status is respected for client errors.
 */

import type { ErrorRequestHandler, Request, Response, NextFunction } from 'express';

export const errorHandler: ErrorRequestHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  // eslint-disable-next-line no-console
  console.error('Unexpected backend error:', err.message);

  // Express body-parser and other middleware attach a status code to client
  // errors (e.g. 400 for malformed JSON). Respect it when present.
  const statusCode =
    (err as { status?: number; statusCode?: number })?.status ??
    (err as { status?: number; statusCode?: number })?.statusCode ??
    500;

  return res.status(statusCode).json({
    success: false,
    error:
      statusCode >= 500
        ? 'Unable to test the connection. Please try again later.'
        : err.message,
  });
};
