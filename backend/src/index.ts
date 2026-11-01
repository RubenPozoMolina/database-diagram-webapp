/**
 * Backend server entry point.
 *
 * Creates the Express app via configureApp() (security middleware, JSON body
 * parsing, test-connection / read-schema / apply-schema routes, health) and
 * starts listening on the configured port. Does not listen when NODE_ENV is
 * 'test' (used by Vitest).
 */

import { app } from './app';

const PORT = Number(process.env.PORT) || 3000;

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Database diagram backend listening on port ${PORT}`);
  });
}

export { app };
export { createApp } from './app';
