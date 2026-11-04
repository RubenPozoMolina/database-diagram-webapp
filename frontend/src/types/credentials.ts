// Credential types for the Database Diagram Web Application
// Database credentials are held in memory only for the current session,
// never persisted to disk or browser storage.

export type DbCredentials = {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
};
