/**
 * Backend server entry point.
 *
 * Starts the Express app listening on the configured port. Intended for local
 * development; the application is wired by the frontend through the
 * /api/v1/connections/test endpoint.
 */

import { app } from './app';

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Database diagram backend listening on port ${PORT}`);
});
