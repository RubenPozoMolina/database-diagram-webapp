/**
 * Application entry point.
 *
 * Creates the Express app and starts listening on the configured port.
 * Does not listen when NODE_ENV is 'test' (used by Vitest).
 */

import { createApp } from './app';

const PORT = Number(process.env.PORT) || 3001;

const app = createApp();

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Backend server listening on port ${PORT}`);
  });
}

export { createApp };
