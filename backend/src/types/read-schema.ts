import { z } from "zod";

export const ReadSchemaRequestSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().positive().max(65535).default(5432),
  database: z.string().min(1),
  user: z.string().min(1),
  password: z.string().min(1),
  schema: z.string().default("public")
});

export type ReadSchemaRequest = z.infer<typeof ReadSchemaRequestSchema>;

export type ColumnInfo = {
  name: string;
  dataType: string;
  isNullable: boolean;
  columnDefault: string | null;
  maxLength: number | null;
};

export type TableInfo = {
  name: string;
  columns: ColumnInfo[];
  primaryKeys: string[];
  foreignKeys: {
    column: string;
    foreignTable: string;
    foreignColumn: string;
  }[];
  uniqueConstraints: string[];
  indexes: string[];
};

export type SchemaInfo = {
  tables: TableInfo[];
};
