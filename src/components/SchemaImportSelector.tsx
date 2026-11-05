/**
 * SchemaImportSelector - UI for importing a PostgreSQL schema as a diagram.
 *
 * Provides:
 *   * A schema selector so the user can choose which schema to introspect.
 *   * An import trigger button that sends the read-schema request to the backend.
 *   * Import progress (loading) and status (success/error) display.
 *
 * Props:
 *   config     - The active PostgreSQL connection configuration (null when
 *                not connected).
 *   onImport   - Called with the built Diagram once the schema has been
 *                successfully imported.
 *   onError    - Called with a user-facing error message when import fails.
 *
 * Accessibility:
 *   * The schema <select> is labelled "Schema to import".
 *   * The import button is labelled "Import Schema" (or "Importing…" while
 *     loading) and is disabled while a request is in flight.
 *   * Status messages use role="status"/role="alert" with aria-live="polite".
 */

import { useCallback, useState } from 'react';
import type { Diagram } from '../types/diagram';
import type { ConnectionConfig } from '../types';
import type { ReadSchemaResponse } from '../connection/readSchemaApi';
import { readSchema } from '../connection/readSchemaApi';
import { schemaToDiagram } from '../connection/schemaToDiagram';

interface SchemaImportSelectorProps {
  config: ConnectionConfig | null;
  onImport: (diagram: Diagram) => void;
}

/** Common PostgreSQL schema names offered in the selector. */
const SCHEMA_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'public', label: 'public' },
  { value: 'information_schema', label: 'information_schema' },
];

export function SchemaImportSelector({
  config,
  onImport,
}: SchemaImportSelectorProps) {
  const [schema, setSchema] = useState<string>('public');
  const [customSchema, setCustomSchema] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importedSchema, setImportedSchema] = useState<
    ReadSchemaResponse | null
  >(null);

  const handleSchemaChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      setCustomSchema('');
      setSchema(event.target.value);
    },
    [],
  );

  const handleCustomSchemaChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setSchema(event.target.value);
    },
    [],
  );

  const handleImport = useCallback(async (): Promise<void> => {
    if (!config) return;
    setIsImporting(true);
    setImportError(null);
    try {
      const result = await readSchema(
        config,
        '/api/read-schema',
        schema || 'public',
      );
      if (result.success) {
        setImportedSchema(result);
        setImportError(null);
        onImport(schemaToDiagram(result));
      } else {
        setImportError(result.error);
      }
    } catch {
      setImportError('Unexpected error while importing schema');
    } finally {
      setIsImporting(false);
    }
  }, [config, schema, onImport]);

  const dismissImportError = useCallback((): void => {
    setImportError(null);
  }, []);

  const dismissImportedSchema = useCallback((): void => {
    setImportedSchema(null);
  }, []);

  const showCustomInput = schema === '';

  const isDisabled = !config || isImporting;

  return (
    <section className="schema-import-panel">
      <div className="schema-import-controls">
        <label htmlFor="schema-select" className="schema-import-label">
          Schema to import
        </label>
        <select
          id="schema-select"
          className="schema-import-select"
          value={schema}
          onChange={handleSchemaChange}
          disabled={isDisabled}
          aria-label="Schema to import"
        >
          {SCHEMA_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
          <option value="">Other…</option>
        </select>
        {showCustomInput && (
          <input
            type="text"
            className="schema-import-custom-input"
            value={customSchema}
            onChange={handleCustomSchemaChange}
            placeholder="Enter schema name"
            disabled={isDisabled}
            aria-label="Custom schema name"
          />
        )}
        <button
          type="button"
          className="import-schema-button"
          onClick={handleImport}
          disabled={isDisabled}
          aria-label="Import PostgreSQL schema as diagram"
        >
          {isImporting ? 'Importing…' : 'Import Schema'}
        </button>
      </div>

      {isImporting && (
        <div
          className="schema-import-progress"
          role="status"
          aria-live="polite"
        >
          Importing schema…
        </div>
      )}

      {importError && (
        <div
          className="schema-import-error"
          role="alert"
          aria-live="polite"
        >
          {importError}
          <button
            type="button"
            className="schema-import-dismiss"
            onClick={dismissImportError}
            aria-label="Dismiss import error"
          >
            ×
          </button>
        </div>
      )}

      {importedSchema && (
        <div
          className="schema-import-info"
          role="status"
          aria-live="polite"
        >
          Imported schema '{importedSchema.schema}' with{' '}
          {importedSchema.tables.length} table(s).
          <button
            type="button"
            className="schema-import-dismiss"
            onClick={dismissImportedSchema}
            aria-label="Dismiss import info"
          >
            ×
          </button>
        </div>
      )}
    </section>
  );
}
