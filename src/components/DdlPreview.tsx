/**
 * DdlPreview - Modal dialog that displays generated DDL to the user and
 * requires explicit confirmation before execution.
 *
 * The component:
 *   * Shows the generated DDL in a read-only code block so the user can
 *     review it before anything is executed.
 *   * Requires an explicit checkbox confirmation ("I confirm I want to
 *     execute this DDL on the database").
 *   * Disables the "Execute DDL" button until the checkbox is checked.
 *   * Never sends DDL to the backend without confirmation (confirm=false).
 *   * Shows success/error messages after the apply attempt.
 *
 * Accessibility:
 *   * role="dialog", aria-modal="true" on the overlay.
 *   * aria-describedby pointing to the DDL code block.
 *   * Explicit <label> for the confirmation checkbox.
 *   * Focus management via autoFocus on the Cancel button.
 *
 * Props:
 *   diagram      - The diagram model to generate DDL from.
 *   connection   - The active PostgreSQL connection config (required).
 *   isOpen       - Whether the modal is visible.
 *   onClose      - Called when the user cancels or closes the dialog.
 *   onExecute    - Called with the DDL string when the user confirms execution.
 *   generateDDL  - Function to generate DDL from the diagram (default export).
 */

import React, { useCallback, useEffect, useState } from 'react';
import type { Diagram } from '../types/diagram';
import type { ConnectionConfig } from '../types';
import { generateDDL } from '../ddl/ddlGenerator';
import { applyDDL, DEFAULT_API_URL } from '../connection/ddlApi';

interface DdlPreviewProps {
  diagram: Diagram;
  connection: ConnectionConfig | null;
  isOpen: boolean;
  onClose: () => void;
  onExecute?: (ddl: string) => void;
  generateDDL?: (diagram: Diagram) => string;
}

interface DdlPreviewState {
  ddl: string | null;
  confirmed: boolean;
  executing: boolean;
  result: { success: boolean; message: string } | null;
}

const DEFAULT_STATE: DdlPreviewState = {
  ddl: null,
  confirmed: false,
  executing: false,
  result: null,
};

export function DdlPreview({
  diagram,
  connection,
  isOpen,
  onClose,
  onExecute,
  generateDDL: generateDDLFn = generateDDL,
}: DdlPreviewProps) {
  const [state, setState] = useState<DdlPreviewState>(DEFAULT_STATE);

  const generate = useCallback((): void => {
    try {
      const ddl = generateDDLFn(diagram);
      setState((prev) => ({ ...prev, ddl, result: null, confirmed: false }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        ddl: null,
        result: {
          success: false,
          message: `Failed to generate DDL: ${err instanceof Error ? err.message : String(err)}`,
        },
      }));
    }
  }, [diagram, generateDDLFn]);

  // Generate DDL when the modal opens.
  useEffect(() => {
    if (!isOpen) return;
    generate();
  }, [isOpen, generate]);

  const toggleConfirm = useCallback((): void => {
    setState((prev) => ({ ...prev, confirmed: !prev.confirmed }));
  }, []);

  const handleExecute = useCallback(async (): Promise<void> => {
    if (state.ddl === null || !connection) return;
    if (!state.confirmed) return;

    setState((prev) => ({ ...prev, executing: true }));

    try {
      const result = await applyDDL(state.ddl, connection, true, DEFAULT_API_URL);
      setState((prev) => ({
        ...prev,
        executing: false,
        result: { success: result.success, message: result.message },
      }));
      if (result.success && onExecute) {
        onExecute(state.ddl);
      }
    } catch (err) {
      setState((prev) => ({
        ...prev,
        executing: false,
        result: {
          success: false,
          message: err instanceof Error ? err.message : 'Unknown error executing DDL',
        },
      }));
    }
  }, [state.ddl, connection, state.confirmed, onExecute]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ddl-preview-title"
      aria-describedby="ddl-preview-description"
      onClick={onClose}
    >
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title" id="ddl-preview-title">
            Review DDL Before Execution
          </h2>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close DDL preview"
          >
            ×
          </button>
        </div>
        <div className="ddl-preview-body">
          <p id="ddl-preview-description">
            The following SQL will be executed against your database. Review it
            carefully and confirm before proceeding. Existing objects are never
            dropped.
          </p>

          {state.ddl === null && state.result === null && (
            <p className="ddl-empty">Generating DDL…</p>
          )}

          {state.ddl !== null && (
            <>
              <div className="ddl-code-container">
                <pre className="ddl-code"><code>{state.ddl}</code></pre>
              </div>

              <div className="ddl-confirmation">
                <label className="confirm-label">
                  <input
                    type="checkbox"
                    checked={state.confirmed}
                    onChange={toggleConfirm}
                    id="ddl-confirm-checkbox"
                    required
                  />
                  {' '}
                  I confirm I want to execute this DDL on the database
                </label>
              </div>

              <div className="ddl-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={onClose}
                  autoFocus
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-execute"
                  disabled={!state.confirmed || state.executing}
                  onClick={handleExecute}
                  aria-disabled={!state.confirmed || state.executing}
                >
                  {state.executing ? 'Executing…' : 'Execute DDL'}
                </button>
              </div>
            </>
          )}

          {state.result !== null && (
            <div
              className={`ddl-result ddl-result--${
                state.result.success ? 'success' : 'error'
              }`}
              role="status"
              aria-live="polite"
            >
              {state.result.message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
