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
  numericPrecision: number | null;
  numericScale: number | null;
  datetimePrecision: number | null;
  intervalType: string | null;
};

export type PrimaryKey = {
  constraintName: string;
  columns: string[];
};

export type ForeignKey = {
  constraintName: string;
  column: string;
  foreignTable: string;
  foreignColumn: string;
  updateRule: string;
  deleteRule: string;
};

export type UniqueConstraint = {
  constraintName: string;
  columns: string[];
};

export type IndexInfo = {
  name: string;
  columns: string[];
  isUnique: boolean;
  isPrimary: boolean;
  isValid: boolean;
  indexType: string;
  definition: string;
};

export type TableInfo = {
  name: string;
  columns: ColumnInfo[];
  primaryKeys: PrimaryKey[];
  foreignKeys: ForeignKey[];
  uniqueConstraints: UniqueConstraint[];
  indexes: IndexInfo[];
};

export type ReadSchemaResponse = {
  success: true;
  schema: string;
  tables: TableInfo[];
};

export type ReadSchemaError = {
  success: false;
  error: string;
};

export type ReadSchemaResult = ReadSchemaResponse | ReadSchemaError;
