import React, { useCallback, useState } from 'react';
import type { Column, Table, UniqueConstraint } from '../types/diagram';

/* Common SQL data types offered when editing a column inline. */
const DATA_TYPES = ['integer', 'varchar', 'text', 'boolean', 'date', 'timestamp', 'decimal'];

interface TableNodeProps {
  table: Table;
  uniqueConstraints?: UniqueConstraint[];
  onUpdatePosition: (id: string, x: number, y: number) => void;
  onColumnPositionUpdate?: (
    tableId: string,
    columnPositions: Map<string, { x: number; y: number }>,
  ) => void;
  onUpdateTable: (id: string, updates: Partial<Omit<Table, 'id'>>) => void;
  onAddColumn: (tableId: string, column: Omit<Column, 'id'>) => void;
  onRemoveColumn: (tableId: string, columnId: string) => void;
  onUpdateColumn: (
    tableId: string,
    columnId: string,
    updates: Partial<Omit<Column, 'id'>>,
  ) => void;
}

export function TableNode({
  table,
  uniqueConstraints = [],
  onUpdatePosition,
  onColumnPositionUpdate,
  onUpdateTable,
  onAddColumn,
  onRemoveColumn,
  onUpdateColumn,
}: TableNodeProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const columnRefs = React.useRef<Map<string, React.RefObject<HTMLDivElement>>>(
    new Map(),
  );
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(table.name);
  const [editingColumn, setEditingColumn] = useState<string | null>(null);
  const [editingIndex, setEditingIndex] = useState<string | null>(null);
  const [newIndexName, setNewIndexName] = useState('');
  const [newIndexColumnId, setNewIndexColumnId] = useState<string | null>(null);

  const getColumnRef = React.useCallback(
    (columnId: string): React.RefObject<HTMLDivElement> => {
      if (!columnRefs.current.has(columnId)) {
        columnRefs.current.set(columnId, React.createRef());
      }
      return columnRefs.current.get(columnId)!;
    },
    [],
  );

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    onUpdatePosition(table.id, rect.left, rect.top);
  }, [table.id, table.width, table.height, onUpdatePosition]);

  const columnIds = React.useMemo(
    () => table.columns.map((c) => c.id).join(','),
    [table.columns],
  );

  React.useEffect(() => {
    if (!onColumnPositionUpdate) return;
    const columnPositions = new Map<string, { x: number; y: number }>();
    for (const [columnId, refObj] of columnRefs.current) {
      const el = refObj.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        columnPositions.set(columnId, { x: rect.left, y: rect.top });
      }
    }
    onColumnPositionUpdate(table.id, columnPositions);
  }, [table.id, columnIds, onColumnPositionUpdate]);

  const saveName = () => {
    const trimmed = nameInput.trim();
    if (trimmed && trimmed !== table.name) {
      onUpdateTable(table.id, { name: trimmed });
    }
    setEditingName(false);
  };

  const updateColumnField = useCallback(
    (columnId: string, updates: Partial<Column>) => {
      onUpdateColumn(table.id, columnId, updates);
    },
    [table.id, onUpdateColumn],
  );

  const addColumn = useCallback(() => {
    const newColumn: Omit<Column, 'id'> = {
      name: 'new_column',
      dataType: 'text',
      nullable: true,
      primaryKey: false,
    };
    onAddColumn(table.id, newColumn);
  }, [table.id, onAddColumn]);

  const removeColumn = useCallback(
    (columnId: string) => {
      onRemoveColumn(table.id, columnId);
      if (editingColumn === columnId) {
        setEditingColumn(null);
      }
    },
    [table.id, onRemoveColumn, editingColumn],
  );

  const exitColumnEdit = () => {
    setEditingColumn(null);
  };

  const columnHasIndex = useCallback(
    (columnId: string) => table.indexes.some((index) => index.columnId === columnId),
    [table.indexes],
  );

  const addIndex = useCallback(() => {
    if (!newIndexColumnId || !newIndexName.trim()) return;
    onUpdateTable(table.id, {
      indexes: [
        ...table.indexes,
        {
          id: crypto.randomUUID(),
          name: newIndexName.trim(),
          columnId: newIndexColumnId,
        },
      ],
    });
    setNewIndexName('');
    setNewIndexColumnId(null);
    setEditingIndex(null);
  }, [table.id, table.indexes, newIndexColumnId, newIndexName, onUpdateTable]);

  const removeIndex = useCallback(
    (indexId: string) => {
      onUpdateTable(table.id, {
        indexes: table.indexes.filter((index) => index.id !== indexId),
      });
      if (editingIndex === indexId) {
        setEditingIndex(null);
      }
    },
    [table.id, table.indexes, editingIndex, onUpdateTable],
  );

  const startIndexEdit = (indexId: string) => {
    const index = table.indexes.find((i) => i.id === indexId);
    if (index) {
      setNewIndexName(index.name);
      setNewIndexColumnId(index.columnId);
      setEditingIndex(indexId);
    }
  };

  const saveIndexEdit = (indexId: string) => {
    if (!newIndexColumnId || !newIndexName.trim()) return;
    onUpdateTable(table.id, {
      indexes: table.indexes.map((index) =>
        index.id === indexId
          ? { ...index, name: newIndexName.trim(), columnId: newIndexColumnId }
          : index,
      ),
    });
    setNewIndexName('');
    setNewIndexColumnId(null);
    setEditingIndex(null);
  };

  const cancelIndexEdit = () => {
    setNewIndexName('');
    setNewIndexColumnId(null);
    setEditingIndex(null);
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
            ref={getColumnRef(column.id)}
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
                <label className="pk-checkbox-label">
                  <input
                    type="checkbox"
                    className="pk-checkbox"
                    checked={column.primaryKey}
                    onChange={(event) =>
                      updateColumnField(column.id, {
                        primaryKey: event.target.checked,
                      })
                    }
                    aria-label={`Primary key for ${column.name}`}
                  />
                  <span className="pk-checkbox-text">PK</span>
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
                title={
              [column.primaryKey ? 'PK' : null, columnHasIndex(column.id) ? 'IX' : null]
                .filter(Boolean)
                .join(' ')
            }
                onDoubleClick={() => setEditingColumn(column.id)}
              >
                {column.name}: {column.dataType}
                {column.primaryKey && (
                  <span className="pk-badge" aria-label="Primary key">
                    🔑 PK
                  </span>
                )}
                {columnHasIndex(column.id) && (
                  <span className="index-badge" aria-label="Indexed">IX</span>
                )}
              </span>
            )}
          </div>
        ))}
        <div className="table-indexes">
          <h3 className="indexes-title">Indexes</h3>
            {editingIndex !== null ? (
              <div className="index-edit-row">
                <input
                  className="index-name-input"
                  autoFocus
                  value={newIndexName}
                  onChange={(event) => setNewIndexName(event.target.value)}
                  placeholder="Index name"
                  aria-label="Index name"
                />
                <select
                  className="index-column-select"
                  value={newIndexColumnId ?? ''}
                  onChange={(event) =>
                    setNewIndexColumnId(event.target.value || null)
                  }
                  aria-label="Column to index"
                >
                  <option value="">Select column</option>
                  {table.columns.map((column) => (
                    <option key={column.id} value={column.id}>
                      {column.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="save-index"
                  onClick={() =>
                    editingIndex === 'new'
                      ? addIndex()
                      : saveIndexEdit(editingIndex as string)
                  }
                  disabled={!newIndexColumnId || !newIndexName.trim()}
                >
                  Save
                </button>
                <button
                  type="button"
                  className="cancel-index"
                  onClick={cancelIndexEdit}
                >
                  Cancel
                </button>
              </div>
            ) : null}
            <ul className="index-list">
              {table.indexes.map((index) => {
                const column = table.columns.find(
                  (c) => c.id === index.columnId,
                );
                return (
                  <li key={index.id} className="index-item">
                    <span className="index-name">{index.name}</span>
                    <span className="index-column">
                      on {column ? column.name : 'unknown column'}
                    </span>
                    {editingIndex === index.id ? null : (
                      <>
                        <button
                          type="button"
                          className="edit-index"
                          onClick={() => startIndexEdit(index.id)}
                          aria-label={`Edit index ${index.name}`}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="remove-index"
                          onClick={() => removeIndex(index.id)}
                          aria-label={`Remove index ${index.name}`}
                        >
                          Remove
                        </button>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              className="add-index"
              onClick={() => {
                setNewIndexName('');
                setNewIndexColumnId(null);
                setEditingIndex('new');
              }}
              aria-label="Add a new index to this table"
            >
              + Add index
            </button>
          </div>

        <button
          type="button"
          className="add-column"
          onClick={addColumn}
          aria-label="Add a new column to this table"
        >
          + Add column
        </button>
      </div>

      {uniqueConstraints.length > 0 && (
        <div className="table-unique-constraints">
          <span className="unique-constraints-label">Unique constraints:</span>
          {uniqueConstraints.map((uc) => {
            const columnNames = table.columns
              .filter((c) => uc.columnIds.includes(c.id))
              .map((c) => c.name)
              .join(', ');
            return (
              <span
                key={uc.id}
                className="unique-constraint-badge"
                title={`Unique constraint${uc.name ? ` (${uc.name})` : ''} on ${columnNames}`}
              >
                UQ
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
