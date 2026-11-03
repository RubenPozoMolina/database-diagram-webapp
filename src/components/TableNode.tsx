import React, { useCallback, useState } from 'react';
import type { Column, Table } from '../types/diagram';

/* Common SQL data types offered when editing a column inline. */
const DATA_TYPES = ['integer', 'varchar', 'text', 'boolean', 'date', 'timestamp', 'decimal'];

interface TableNodeProps {
  table: Table;
  onUpdatePosition: (id: string, x: number, y: number) => void;
  onUpdateTable: (id: string, updates: Partial<Omit<Table, 'id'>>) => void;
}

export function TableNode({ table, onUpdatePosition, onUpdateTable }: TableNodeProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(table.name);
  const [editingColumn, setEditingColumn] = useState<string | null>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    onUpdatePosition(table.id, rect.left, rect.top);
  }, [table.id, table.width, table.height, onUpdatePosition]);

  const saveName = () => {
    const trimmed = nameInput.trim();
    if (trimmed && trimmed !== table.name) {
      onUpdateTable(table.id, { name: trimmed });
    }
    setEditingName(false);
  };

  const updateColumnField = useCallback(
    (columnId: string, updates: Partial<Column>) => {
      onUpdateTable(table.id, {
        columns: table.columns.map((column) =>
          column.id === columnId ? { ...column, ...updates } : column,
        ),
      });
    },
    [table.id, table.columns, onUpdateTable],
  );

  const addColumn = useCallback(() => {
    const newColumn: Column = {
      id: crypto.randomUUID(),
      name: 'new_column',
      dataType: 'text',
      nullable: true,
      primaryKey: false,
    };
    onUpdateTable(table.id, {
      columns: [...table.columns, newColumn],
    });
    setEditingColumn(newColumn.id);
  }, [table.id, table.columns, onUpdateTable]);

  const removeColumn = useCallback(
    (columnId: string) => {
      onUpdateTable(table.id, {
        columns: table.columns.filter((column) => column.id !== columnId),
      });
      if (editingColumn === columnId) {
        setEditingColumn(null);
      }
    },
    [table.id, table.columns, editingColumn, onUpdateTable],
  );

  const exitColumnEdit = () => {
    setEditingColumn(null);
  };

  return (
    <div
      ref={ref}
      className="table-node"
      style={{
        left: table.x,
        top: table.y,
        width: table.width,
        height: table.height,
      }}
      role="region"
      aria-label={`Table ${table.name}`}
    >
      <div className="table-header" onDoubleClick={() => setEditingName(true)}>
        {editingName ? (
          <input
            className="table-name-input"
            autoFocus
            value={nameInput}
            onChange={(event) => setNameInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                saveName();
              }
              if (event.key === 'Escape') {
                setNameInput(table.name);
                setEditingName(false);
              }
            }}
            onBlur={saveName}
          />
        ) : (
          <span className="table-name">{table.name}</span>
        )}
      </div>
      <div className="table-columns">
        {table.columns.map((column) => (
          <div
            key={column.id}
            className={`table-column ${editingColumn === column.id ? 'editing' : ''}`}
            title={column.primaryKey ? 'PK' : ''}
          >
            {editingColumn === column.id ? (
              <div className="column-edit-row">
                <input
                  className="column-name-input"
                  autoFocus
                  value={column.name}
                  onChange={(event) =>
                    updateColumnField(column.id, { name: event.target.value })
                  }
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      exitColumnEdit();
                    }
                    if (event.key === 'Escape') {
                      exitColumnEdit();
                    }
                  }}
                  onBlur={exitColumnEdit}
                />
                <select
                  className="column-type-select"
                  value={column.dataType}
                  onChange={(event) =>
                    updateColumnField(column.id, { dataType: event.target.value })
                  }
                >
                  {DATA_TYPES.map((dataType) => (
                    <option key={dataType} value={dataType}>
                      {dataType}
                    </option>
                  ))}
                </select>
                <label className="nullable-checkbox-label">
                  <input
                    type="checkbox"
                    className="nullable-checkbox"
                    checked={column.nullable}
                    onChange={(event) =>
                      updateColumnField(column.id, {
                        nullable: event.target.checked,
                      })
                    }
                    aria-label={`Nullable for ${column.name}`}
                  />
                  <span className="nullable-checkbox-text">Nullable</span>
                </label>
                <input
                  className="column-default-input"
                  type="text"
                  value={column.defaultValue ?? ''}
                  placeholder="Default"
                  title="Default value"
                  onChange={(event) =>
                    updateColumnField(column.id, {
                      defaultValue: event.target.value || undefined,
                    })
                  }
                  onBlur={() => setEditingColumn(null)}
                />
                <button
                  type="button"
                  className="remove-column"
                  onClick={() => removeColumn(column.id)}
                  aria-label={`Remove column ${column.name}`}
                >
                  Remove
                </button>
              </div>
            ) : (
              <span
                className="column-text"
                onDoubleClick={() => setEditingColumn(column.id)}
              >
                {column.name}: {column.dataType}
              </span>
            )}
          </div>
        ))}
        <button
          type="button"
          className="add-column"
          onClick={addColumn}
          aria-label="Add a new column to this table"
        >
          + Add column
        </button>
      </div>
    </div>
  );
}
