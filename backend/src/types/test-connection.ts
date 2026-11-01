import { z } from "zod";

export const TestConnectionRequestSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().positive().max(65535).default(5432),
  database: z.string().min(1),
  user: z.string().min(1),
  password: z.string().min(1)
});

export type TestConnectionRequest = z.infer<typeof TestConnectionRequestSchema>;

export interface TestConnectionResult {
  success: boolean;
  message: string;
  serverVersion?: string;
}
