import React, { useCallback, useState } from 'react';
import type { Column } from '../types/diagram';

interface CreateTableModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (table: { name: string; columns: Column[] }) => void;
}

/* Common SQL data types offered when creating a column. */
const DATA_TYPES = ['integer', 'varchar', 'text', 'boolean', 'date', 'timestamp', 'decimal'];

function newColumn(): Column {
  return {
    id: crypto.randomUUID(),
    name: '',
    dataType: 'text',
    nullable: true,
    primaryKey: false,
  };
}

export function CreateTableModal({
  isOpen,
  onClose,
  onCreate,
}: CreateTableModalProps) {
  const [name, setName] = useState('');
  const [columns, setColumns] = useState<Column[]>([]);
  const [error, setError] = useState('');

  const addColumn = useCallback(() => {
    setColumns((prev) => [...prev, newColumn()]);
  }, []);

  const removeColumn = useCallback((id: string) => {
    setColumns((prev) => prev.filter((column) => column.id !== id));
  }, []);

  const updateColumn = useCallback(
    (id: string, updates: Partial<Column>) => {
      setColumns((prev) =>
        prev.map((column) =>
          column.id === id ? { ...column, ...updates } : column,
        ),
      );
    },
    [],
  );

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!name.trim()) {
      setError('Table name is required.');
      return;
    }
    onCreate({ name: name.trim(), columns });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Add table"
      onClick={onClose}
    >
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Add Table</h2>
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
          <div className="form-field">
            <label htmlFor="table-name">Table name</label>
            <input
              id="table-name"
              type="text"
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. users"
              required
            />
            {error && <p className="form-error">{error}</p>}
          </div>

          <div className="form-field">
            <label>Columns</label>
            <div className="columns-list">
              {columns.map((column) => (
                <div key={column.id} className="column-row">
                  <input
                    type="text"
                    value={column.name}
                    onChange={(event) =>
                      updateColumn(column.id, { name: event.target.value })
                    }
                    placeholder="Column name"
                  />
                  <select
                    value={column.dataType}
                    onChange={(event) =>
                      updateColumn(column.id, {
                        dataType: event.target.value,
                      })
                    }
                  >
                    {DATA_TYPES.map((dataType) => (
                      <option key={dataType} value={dataType}>
                        {dataType}
                      </option>
                    ))}
                  </select>
                  <label className="pk-checkbox-label">
                    <input
                      type="checkbox"
                      className="pk-checkbox"
                      checked={column.primaryKey}
                      onChange={(event) =>
                        updateColumn(column.id, {
                          primaryKey: event.target.checked,
                        })
                      }
                      aria-label={`Primary key for ${column.name || column.id}`}
                    />
                    <span className="pk-checkbox-text">PK</span>
                  </label>
                  <button
                    type="button"
                    className="remove-column"
                    onClick={() => removeColumn(column.id)}
                    aria-label={`Remove column ${column.name || column.id}`}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="add-column"
                onClick={addColumn}
              >
                + Add column
              </button>
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-create"
              disabled={!name.trim()}
            >
              Create Table
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
