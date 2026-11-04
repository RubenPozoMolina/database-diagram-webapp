import React, { useCallback, useState } from 'react';
import type { Column, Table } from '../types/diagram';

interface CreateRelationshipModalProps {
  isOpen: boolean;
  onClose: () => void;
  tables: Table[];
  onCreate: (relationship: {
    sourceTableId: string;
    sourceColumnId: string;
    targetTableId: string;
    targetColumnId: string;
  }) => void;
}

export function CreateRelationshipModal({
  isOpen,
  onClose,
  tables,
  onCreate,
}: CreateRelationshipModalProps) {
  const [sourceTableId, setSourceTableId] = useState<string | null>(null);
  const [sourceColumnId, setSourceColumnId] = useState<string | null>(null);
  const [targetTableId, setTargetTableId] = useState<string | null>(null);
  const [targetColumnId, setTargetColumnId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const sourceTable = sourceTableId
    ? tables.find((table) => table.id === sourceTableId)
    : undefined;
  const targetTable = targetTableId
    ? tables.find((table) => table.id === targetTableId)
    : undefined;

  const sourceColumns = sourceTable ? sourceTable.columns : [];
  const targetColumns = targetTable ? targetTable.columns : [];

  const resetColumnSelection = useCallback(() => {
    setSourceColumnId(null);
    setTargetColumnId(null);
  }, []);

  const handleSourceTableChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      setError('');
      setSourceTableId(event.target.value || null);
      resetColumnSelection();
    },
    [resetColumnSelection],
  );

  const handleTargetTableChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      setError('');
      setTargetTableId(event.target.value || null);
      setTargetColumnId(null);
    },
    [],
  );

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (
      !sourceTableId ||
      !sourceColumnId ||
      !targetTableId ||
      !targetColumnId
    ) {
      setError('Please select source and target tables and columns.');
      return;
    }
    if (sourceTableId === targetTableId) {
      setError('Source and target tables must be different.');
      return;
    }
    onCreate({
      sourceTableId,
      sourceColumnId,
      targetTableId,
      targetColumnId,
    });
    onClose();
  };

  const isComplete =
    Boolean(sourceTableId) &&
    Boolean(sourceColumnId) &&
    Boolean(targetTableId) &&
    Boolean(targetColumnId) &&
    sourceTableId !== targetTableId;

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Add relationship"
      onClick={onClose}
    >
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Add Relationship</h2>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <form className="create-table-form" onSubmit={handleSubmit}>
          {error && <p className="form-error">{error}</p>}

          <div className="form-field">
            <label htmlFor="source-table-select">Source table</label>
            <select
              id="source-table-select"
              value={sourceTableId ?? ''}
              onChange={handleSourceTableChange}
            >
              <option value="">Select a table</option>
              {tables.map((table) => (
                <option key={table.id} value={table.id}>
                  {table.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="source-column-select">Source column</label>
            <select
              id="source-column-select"
              value={sourceColumnId ?? ''}
              onChange={(event) =>
                setSourceColumnId(event.target.value || null)
              }
              disabled={!sourceTable}
            >
              <option value="">Select a column</option>
              {sourceColumns.map((column: Column) => (
                <option key={column.id} value={column.id}>
                  {column.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="target-table-select">Target table</label>
            <select
              id="target-table-select"
              value={targetTableId ?? ''}
              onChange={handleTargetTableChange}
            >
              <option value="">Select a table</option>
              {tables
                .filter((table) => table.id !== sourceTableId)
                .map((table) => (
                  <option key={table.id} value={table.id}>
                    {table.name}
                  </option>
                ))}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="target-column-select">Target column</label>
            <select
              id="target-column-select"
              value={targetColumnId ?? ''}
              onChange={(event) =>
                setTargetColumnId(event.target.value || null)
              }
              disabled={!targetTable}
            >
              <option value="">Select a column</option>
              {targetColumns.map((column: Column) => (
                <option key={column.id} value={column.id}>
                  {column.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-create"
              disabled={!isComplete}
            >
              Create Relationship
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
