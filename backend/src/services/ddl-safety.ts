/**
 * DDL (Data Definition Language) safety validation.
 *
 * Ensures that no DROP or ALTER statements are executed that would modify
 * or drop existing database objects. Only CREATE statements for new objects
 * are allowed, plus ALTER TABLE ... ADD CONSTRAINT and ALTER TABLE ... ADD
 * COLUMN which add new objects rather than modifying existing ones.
 *
 * All checks are case-insensitive and operate on individual statements
 * split by semicolons. SQL comments are stripped before analysis.
 */

/**
 * Result of a DDL safety check.
 */
export type DdlSafetyResult = {
  /** true when every statement is safe to execute. */
  safe: boolean;
  /** Descriptive error message when the DDL is rejected. */
  error?: string;
  /** The offending statement (trimmed), when rejected. */
  statement?: string;
}

/**
 * Removes SQL line comments (dash-dash to end of line) and block comments
 * (slash-star to star-slash) from a statement so that keywords inside
 * comments are not mistaken for commands.
 */
function stripComments(sql: string): string {
  return sql
    // Block comments /* ... */
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    // Line comments -- ... (not at the start of a string literal)
    .replace(/--[^\n]*/g, " ");
}

/**
 * Normalises a statement for keyword analysis: upper-case, trimmed,
 * comments stripped, whitespace collapsed.
 */
function normalise(stmt: string): string {
  return stripComments(stmt)
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Checks whether a normalised statement starts with a given SQL keyword.
 */
function startsWith(normalised: string, keyword: string): boolean {
  return normalised.startsWith(keyword) &&
    (normalised.length === keyword.length ||
      /[\s(]/.test(normalised[keyword.length] ?? ""));
}

/**
 * Checks whether a normalised statement contains a given keyword as a whole
 * word (not as a substring of another keyword such as ON DELETE).
 */
function containsKeyword(normalised: string, keyword: string): boolean {
  const re = new RegExp(`\\b${keyword}\\b`);
  return re.test(normalised);
}

/**
 * Validates a complete DDL script. Returns the first unsafe statement found.
 *
 * Allowed:
 *   - CREATE ... (any CREATE statement creates new objects)
 *   - ALTER TABLE ... ADD CONSTRAINT ... (adds a new constraint)
 *   - ALTER TABLE ... ADD COLUMN ... (adds a new column)
 *
 * Rejected:
 *   - DROP ... (any DROP statement removes an existing object)
 *   - TRUNCATE ... (removes all rows from an existing table)
 *   - DELETE ... (as a standalone statement, not the ON DELETE clause)
 *   - ALTER TABLE ... DROP COLUMN / DROP CONSTRAINT (removes existing objects)
 *   - ALTER TABLE ... ALTER COLUMN / MODIFY COLUMN (modifies existing objects)
 *   - ALTER TABLE ... RENAME (modifies existing objects)
 *   - Any other ALTER statement that is not ADD CONSTRAINT / ADD COLUMN
 *   - Any statement that does not start with CREATE or ALTER
 */
export function validateDdlSafety(ddl: string): DdlSafetyResult {
  // Strip comments from the entire script before splitting, so that block
  // comments spanning multiple lines are handled correctly.
  const withoutComments = stripComments(ddl);

  const statements = withoutComments
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const rawStmt of statements) {
    const stmt = normalise(rawStmt);
    // Skip statements that are empty after comment stripping
    // (for example a standalone SQL comment between semicolons).
    if (stmt.length === 0) {
      continue;
    }
    const firstWord = stmt.split(/\s+/)[0];

    // --- DROP statements -------------------------------------------------
    if (startsWith(stmt, "DROP")) {
      return {
        safe: false,
        error:
          "Rejected: DROP statements are not allowed. Existing database objects are never dropped.",
        statement: rawStmt,
      };
    }

    // --- TRUNCATE statements --------------------------------------------
    if (startsWith(stmt, "TRUNCATE")) {
      return {
        safe: false,
        error:
          "Rejected: TRUNCATE statements are not allowed. Existing tables are never truncated.",
        statement: rawStmt,
      };
    }

    // --- DELETE statements (standalone, not ON DELETE) ------------------
    if (startsWith(stmt, "DELETE")) {
      return {
        safe: false,
        error:
          "Rejected: DELETE statements are not allowed. Existing data is never deleted.",
        statement: rawStmt,
      };
    }

    // --- ALTER statements ------------------------------------------------
    if (startsWith(stmt, "ALTER")) {
      // ALTER TABLE ... ADD CONSTRAINT creates a new constraint object.
      if (containsKeyword(stmt, "ADD") && containsKeyword(stmt, "CONSTRAINT")) {
        continue;
      }
      // ALTER TABLE ... ADD COLUMN creates a new column object.
      if (containsKeyword(stmt, "ADD") && containsKeyword(stmt, "COLUMN")) {
        continue;
      }
      // ALTER TABLE ... DROP COLUMN removes an existing column.
      if (containsKeyword(stmt, "DROP") && containsKeyword(stmt, "COLUMN")) {
        return {
          safe: false,
          error:
            "Rejected: ALTER TABLE ... DROP COLUMN is not allowed. Existing columns are never dropped.",
          statement: rawStmt,
        };
      }
      // ALTER TABLE ... DROP CONSTRAINT removes an existing constraint.
      if (containsKeyword(stmt, "DROP") && containsKeyword(stmt, "CONSTRAINT")) {
        return {
          safe: false,
          error:
            "Rejected: ALTER TABLE ... DROP CONSTRAINT is not allowed. Existing constraints are never dropped.",
          statement: rawStmt,
        };
      }
      // ALTER TABLE ... MODIFY COLUMN modifies an existing column.
      if (containsKeyword(stmt, "MODIFY") && containsKeyword(stmt, "COLUMN")) {
        return {
          safe: false,
          error:
            "Rejected: MODIFY COLUMN is not allowed. Existing columns are never modified.",
          statement: rawStmt,
        };
      }
      // ALTER ... RENAME modifies an existing object name.
      if (containsKeyword(stmt, "RENAME")) {
        return {
          safe: false,
          error:
            "Rejected: RENAME is not allowed. Existing objects are never renamed.",
          statement: rawStmt,
        };
      }
      // ALTER TABLE ... ALTER COLUMN modifies an existing column.
      if (
        containsKeyword(stmt, "ALTER") &&
        containsKeyword(stmt, "COLUMN")
      ) {
        return {
          safe: false,
          error:
            "Rejected: ALTER COLUMN is not allowed. Existing columns are never modified.",
          statement: rawStmt,
        };
      }
      // Any other ALTER statement modifies existing objects.
      return {
        safe: false,
        error:
          "Rejected: ALTER statements are not allowed. Only CREATE statements and ALTER TABLE ... ADD CONSTRAINT / ADD COLUMN are permitted.",
        statement: rawStmt,
      };
    }

    // --- Only CREATE statements (and the ALTER variants above) are allowed
    if (!startsWith(stmt, "CREATE")) {
      return {
        safe: false,
        error:
          `Rejected: only CREATE statements are allowed. Statement starting with '${firstWord}' is not permitted.`,
        statement: rawStmt,
      };
    }
  }

  return { safe: true };
}
