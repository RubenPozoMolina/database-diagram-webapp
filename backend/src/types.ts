/**
 * Domain types for the backend API.
 */

export interface ConnectionParams {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

export interface TestResult {
  success: boolean;
  message?: string;
  error?: string;
  statusCode?: number;
}
