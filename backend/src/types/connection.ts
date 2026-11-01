/**
 * Request and response types for the test-connection endpoint.
 *
 * Defined per the TASK-051 API specification (docs/api/test-connection.md).
 */

export interface TestConnectionRequest {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

export interface TestConnectionSuccessResponse {
  success: true;
  message: string;
}

export interface TestConnectionErrorResponse {
  success: false;
  error: string;
}

export type TestConnectionResponse =
  | TestConnectionSuccessResponse
  | TestConnectionErrorResponse;
