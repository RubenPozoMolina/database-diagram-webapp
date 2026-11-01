import { z } from "zod";

export const ApplySchemaRequestSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().positive().max(65535).default(5432),
  database: z.string().min(1),
  user: z.string().min(1),
  password: z.string().min(1),
  schema: z.string().default("public"),
  ddl: z.string().min(1),
  confirm: z.boolean()
});

export type ApplySchemaRequest = z.infer<typeof ApplySchemaRequestSchema>;

export type ApplySchemaResult = {
  success: boolean;
  message: string;
  ddlPreview: string;
};
