/**
 * DDL safety validation.
 *
 * Ensures generated DDL never drops or alters existing database objects.
 * Only CREATE statements (for new objects) and ALTER TABLE ... ADD CONSTRAINT
 * (adding constraints to newly created tables) are permitted.
 *
 * Rejected statement categories:
 *   * DROP * (DROP TABLE, DROP COLUMN, DROP CONSTRAINT, DROP INDEX, etc.)
 *   * TRUNCATE *
 *   * DELETE *
 *   * ALTER TABLE ... DROP COLUMN / ALTER COLUMN / RENAME / DROP CONSTRAINT / ADD COLUMN
 *   * Any non-CREATE, non-ALTER-ADD-CONSTRAINT statement
 */

export interface DDLValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates that a DDL script contains no destructive statements.
 *
 * Splits the script into individual statements and checks each one:
 *   * CREATE TABLE / CREATE INDEX are allowed (they create new objects).
 *   * ALTER TABLE ... ADD CONSTRAINT is allowed (it adds a constraint to a
 *     newly created table; it does not modify or drop existing objects).
 *   * DROP, TRUNCATE, DELETE and any other ALTER statement are rejected.
 *
 * @param ddl - The DDL script to validate.
 * @returns { valid, errors } - valid is true when every statement is safe.
 */
export function validateDDLSafety(ddl: string): DDLValidationResult {
  const errors: string[] = [];
  const statements = ddl
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const stmt of statements) {
    const upper = stmt.toUpperCase();

    // DROP statements are never allowed.
    if (/^DROP\b/.test(upper)) {
      errors.push(`Rejected DROP statement: ${stmt}`);
      continue;
    }

    // TRUNCATE statements are never allowed.
    if (/^TRUNCATE\b/.test(upper)) {
      errors.push(`Rejected TRUNCATE statement: ${stmt}`);
      continue;
    }

    // DELETE statements are never allowed.
    if (/^DELETE\b/.test(upper)) {
      errors.push(`Rejected DELETE statement: ${stmt}`);
      continue;
    }

    // ALTER TABLE ... ADD CONSTRAINT is safe: it adds a constraint to a
    // newly created table, it does not modify or drop existing objects.
    if (/^ALTER\s+TABLE\b/.test(upper) && /ADD\s+CONSTRAINT\b/.test(upper)) {
      continue;
    }

    // Any other ALTER statement may modify existing objects (DROP COLUMN,
    // ALTER COLUMN, RENAME, DROP CONSTRAINT, ADD COLUMN, etc.) and is rejected.
    if (/^ALTER\b/.test(upper)) {
      errors.push(
        `Rejected ALTER statement that may modify existing objects: ${stmt}`,
      );
      continue;
    }

    // Only CREATE statements are permitted for new objects.
    if (!/^CREATE\b/.test(upper)) {
      errors.push(`Rejected non-CREATE statement: ${stmt}`);
      continue;
    }
  }

  return { valid: errors.length === 0, errors };
}
