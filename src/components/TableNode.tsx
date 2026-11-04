import React, { useCallback, useRef, useState } from 'react';
import type { Column, Table, UniqueConstraint } from '../types/diagram';

/* Common SQL data types offered when editing a column inline. */
const DATA_TYPES = ['integer', 'varchar', 'text', 'boolean', 'date', 'timestamp', 'decimal'];

// Minimum size a table can be resized to. Enforced while resizing and keeps
// the header and at least one column row visible so the table remains usable.
const MIN_TABLE_WIDTH = 160;
const MIN_TABLE_HEIGHT = 80;

interface TableNodeProps {
  table: Table;
  uniqueConstraints?: UniqueConstraint[];
  onUpdatePosition: (id: string, x: number, y: number) => void;
  onColumnPositionUpdate?: (
    tableId: string,
    columnPositions: Map<string, { x: number; y: number }>,
  ) => void;
  onUpdateTable: (id: string, updates: Partial<Omit<Table, 'id'>>) => void;
  onDeleteTable: (tableId: string) => void;
  onAddColumn: (tableId: string, column: Omit<Column, 'id'>) => void;
  onRemoveColumn: (tableId: string, columnId: string) => void;
  onUpdateColumn: (
    tableId: string,
    columnId: string,
    updates: Partial<Omit<Column, 'id'>>,
  ) => void;
  onAddUniqueConstraint: (
    tableId: string,
    columnIds: string[],
    name?: string,
  ) => void;
  onRemoveUniqueConstraint: (constraintId: string) => void;
  onUpdateUniqueConstraint: (
    constraintId: string,
    updates: Partial<Omit<UniqueConstraint, 'id'>>,
  ) => void;
}

export function TableNode({
  table,
  uniqueConstraints = [],
  onUpdatePosition,
  onColumnPositionUpdate,
  onUpdateTable,
  onDeleteTable,
  onAddColumn,
  onRemoveColumn,
  onUpdateColumn,
  onAddUniqueConstraint,
  onRemoveUniqueConstraint,
  onUpdateUniqueConstraint,
}: TableNodeProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const columnRefs = React.useRef<Map<string, React.RefObject<HTMLDivElement>>>(
    new Map(),
  );
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(table.name);
  const [editingColumn, setEditingColumn] = useState<string | null>(null);
  const [editingIndex, setEditingIndex] = useState<string | null>(null);

  // Drag / resize interaction state.
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{
    x: number;
    y: number;
    clientX: number;
    clientY: number;
  } | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartRef = useRef<{
    width: number;
    height: number;
    clientX: number;
    clientY: number;
  } | null>(null);
  const [newIndexName, setNewIndexName] = useState('');
  const [newIndexColumnId, setNewIndexColumnId] = useState<string | null>(null);
  const [editingConstraint, setEditingConstraint] = useState<string | null>(null);
  const [newConstraintName, setNewConstraintName] = useState('');
  const [newConstraintColumnIds, setNewConstraintColumnIds] = useState<string[]>([]);


  const getColumnRef = React.useCallback(
    (columnId: string): React.RefObject<HTMLDivElement> => {
      if (!columnRefs.current.has(columnId)) {
        columnRefs.current.set(columnId, React.createRef());
      }
      return columnRefs.current.get(columnId)!;
    },
    [],
  );

  /* ---- Drag to move ---- */
  const handleDragStart = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      // Only left-click initiates a drag; ignore double-clicks (name editing).
      if (event.button !== 0 || event.detail !== 1) return;
      event.preventDefault();
      setIsDragging(true);
      dragStartRef.current = {
        x: table.x,
        y: table.y,
        clientX: event.clientX,
        clientY: event.clientY,
      };
    },
    [table.x, table.y],
  );

  const handleDragMove = useCallback(
    (event: PointerEvent) => {
      if (!dragStartRef.current) return;
      const dx = event.clientX - dragStartRef.current.clientX;
      const dy = event.clientY - dragStartRef.current.clientY;
      onUpdatePosition(
        table.id,
        dragStartRef.current.x + dx,
        dragStartRef.current.y + dy,
      );
    },
    [table.id, onUpdatePosition],
  );

  const handleDragEnd = useCallback(() => {
    dragStartRef.current = null;
    setIsDragging(false);
  }, []);

  /* ---- Resize ---- */
  const handleResizeStart = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation(); // do not trigger table drag
      setIsResizing(true);
      resizeStartRef.current = {
        width: table.width,
        height: table.height,
        clientX: event.clientX,
        clientY: event.clientY,
      };
    },
    [table.width, table.height],
  );

  const handleResizeMove = useCallback(
    (event: PointerEvent) => {
      if (!resizeStartRef.current) return;
      const dx = event.clientX - resizeStartRef.current.clientX;
      const dy = event.clientY - resizeStartRef.current.clientY;
      const newWidth = Math.max(
        MIN_TABLE_WIDTH,
        resizeStartRef.current.width + dx,
      );
      const newHeight = Math.max(
        MIN_TABLE_HEIGHT,
        resizeStartRef.current.height + dy,
      );
      onUpdateTable(table.id, { width: newWidth, height: newHeight });
    },
    [table.id, onUpdateTable],
  );

  const handleResizeEnd = useCallback(() => {
    resizeStartRef.current = null;
    setIsResizing(false);
  }, []);

  /* ---- Delete ---- */
  const handleDeleteTable = useCallback(() => {
    onDeleteTable(table.id);
  }, [table.id, onDeleteTable]);

  React.useEffect(() => {
    window.addEventListener('pointermove', handleDragMove);
    window.addEventListener('pointerup', handleDragEnd);
    window.addEventListener('pointermove', handleResizeMove);
    window.addEventListener('pointerup', handleResizeEnd);
    return () => {
      window.removeEventListener('pointermove', handleDragMove);
      window.removeEventListener('pointerup', handleDragEnd);
      window.removeEventListener('pointermove', handleResizeMove);
      window.removeEventListener('pointerup', handleResizeEnd);
    };
  }, [handleDragMove, handleDragEnd, handleResizeMove, handleResizeEnd]);

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

  // Drag: follow the mouse and report the new position to the diagram so the
  // canvas updates when a table is moved.
  React.useEffect(() => {
    if (!isDragging || !dragStartRef.current) return;
    const start = dragStartRef.current;
    const handleMouseMove = (event: MouseEvent) => {
      const dx = event.clientX - start.clientX;
      const dy = event.clientY - start.clientY;
      onUpdatePosition(table.id, start.x + dx, start.y + dy);
    };
    const handleMouseUp = () => {
      setIsDragging(false);
      dragStartRef.current = null;
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, table.id, onUpdatePosition]);

  // Resize: follow the mouse and report the new size to the diagram so the
  // canvas updates when a table is resized.
  React.useEffect(() => {
    if (!isResizing || !resizeStartRef.current) return;
    const start = resizeStartRef.current;
    const handleMouseMove = (event: MouseEvent) => {
      const dw = event.clientX - start.clientX;
      const dh = event.clientY - start.clientY;
      const newWidth = Math.max(MIN_TABLE_WIDTH, start.width + dw);
      const newHeight = Math.max(MIN_TABLE_HEIGHT, start.height + dh);
      onUpdateTable(table.id, { width: newWidth, height: newHeight });
    };
    const handleMouseUp = () => {
      setIsResizing(false);
      resizeStartRef.current = null;
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, table.id, onUpdateTable, MIN_TABLE_WIDTH, MIN_TABLE_HEIGHT]);

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

  const handleTableMouseDown = useCallback(
    (event: React.MouseEvent) => {
      if (event.button !== 0) return;
      // Never start a drag from an interactive element (input, button, select).
      const target = event.target as HTMLElement;
      if (
        target.closest('input, button, select, textarea, [contenteditable="true"]')
      ) {
        return;
      }
      // Don't drag while a field is being edited.
      if (editingName || editingColumn || editingIndex || editingConstraint) {
        return;
      }
      setIsDragging(true);
      dragStartRef.current = {
        x: table.x,
        y: table.y,
        clientX: event.clientX,
        clientY: event.clientY,
      };
    },
    [
      table.x,
      table.y,
      editingName,
      editingColumn,
      editingIndex,
      editingConstraint,
    ],
  );

  const handleResizeMouseDown = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      if (event.button !== 0) return;
      setIsResizing(true);
      resizeStartRef.current = {
        width: table.width,
        height: table.height,
        clientX: event.clientX,
        clientY: event.clientY,
      };
    },
    [table.width, table.height],
  );

  const addColumn = useCallback(() => {
    const newColumn: Omit<Column, 'id'> = {
      name: 'new_column',
      dataType: 'text',
      length: null,
      nullable: true,
      primaryKey: false,
      unique: false,
      comment: null,
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
    (columnId: string) =>
      table.indexes.some((index) => index.columnIds.includes(columnId)),
    [table.indexes],
  );

  const addIndex = useCallback(() => {
    if (!newIndexColumnId || !newIndexName.trim()) return;
    onUpdateTable(table.id, {
      indexes: [
        ...table.indexes,
        {
          id: crypto.randomUUID(),
          tableId: table.id,
          name: newIndexName.trim(),
          columnIds: [newIndexColumnId],
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
      setNewIndexColumnId(index.columnIds[0]);
      setEditingIndex(indexId);
    }
  };

  const saveIndexEdit = (indexId: string) => {
    if (!newIndexColumnId || !newIndexName.trim()) return;
    onUpdateTable(table.id, {
      indexes: table.indexes.map((index) =>
        index.id === indexId
          ? { ...index, name: newIndexName.trim(), columnIds: [newIndexColumnId] }
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

  const addUniqueConstraint = useCallback(() => {
    if (!newConstraintName.trim() || newConstraintColumnIds.length === 0) return;
    onAddUniqueConstraint(
      table.id,
      newConstraintColumnIds,
      newConstraintName.trim(),
    );
    setNewConstraintName('');
    setNewConstraintColumnIds([]);
    setEditingConstraint(null);
  }, [
    table.id,
    newConstraintName,
    newConstraintColumnIds,
    onAddUniqueConstraint,
  ]);

  const removeUniqueConstraint = useCallback(
    (constraintId: string) => {
      onRemoveUniqueConstraint(constraintId);
      if (editingConstraint === constraintId) {
        setEditingConstraint(null);
      }
    },
    [onRemoveUniqueConstraint, editingConstraint],
  );

  const startConstraintEdit = (constraintId: string) => {
    const constraint = uniqueConstraints.find((uc) => uc.id === constraintId);
    if (constraint) {
      setNewConstraintName(constraint.name ?? '');
      setNewConstraintColumnIds([...constraint.columnIds]);
      setEditingConstraint(constraintId);
    }
  };

  const saveConstraintEdit = (constraintId: string) => {
    if (!newConstraintName.trim() || newConstraintColumnIds.length === 0) return;
    onUpdateUniqueConstraint(constraintId, {
      name: newConstraintName.trim(),
      columnIds: newConstraintColumnIds,
    });
    setNewConstraintName('');
    setNewConstraintColumnIds([]);
    setEditingConstraint(null);
  };

  const cancelConstraintEdit = () => {
    setNewConstraintName('');
    setNewConstraintColumnIds([]);
    setEditingConstraint(null);
  };

  const toggleConstraintColumn = useCallback((columnId: string) => {
    setNewConstraintColumnIds((prev) =>
      prev.includes(columnId)
        ? prev.filter((cid) => cid !== columnId)
        : [...prev, columnId],
    );
  }, []);

  return (
    <div
      ref={ref}
      className="table-node"
      style={{
        left: table.x,
        top: table.y,
        width: table.width,
        height: table.height,
        cursor: isDragging ? 'grabbing' : 'grab',
        touchAction: 'none',
      }}
      role="region"
      aria-label={`Table ${table.name}`}
      aria-grabbed={isDragging}
      onMouseDown={handleTableMouseDown}
    >
      <div
        className="table-header"
        onDoubleClick={() => setEditingName(true)}
        onPointerDown={handleDragStart}
        style={{
          cursor: isDragging ? 'grabbing' : 'grab',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
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
        <button
          type="button"
          className="delete-table"
          onClick={handleDeleteTable}
          aria-label={`Delete table ${table.name}`}
        >
          Delete
        </button>
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
                const column = table.columns.find((c) =>
                  index.columnIds.includes(c.id),
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

          <div className="table-unique-constraints">
            <h3 className="constraints-title">Unique constraints</h3>
            {editingConstraint !== null ? (
              <div className="constraint-edit-row">
                <input
                  className="constraint-name-input"
                  autoFocus
                  value={newConstraintName}
                  onChange={(event) =>
                    setNewConstraintName(event.target.value)
                  }
                  placeholder="Constraint name"
                  aria-label="Unique constraint name"
                />
                {table.columns.map((column) => (
                  <label
                    key={column.id}
                    className="constraint-checkbox-label"
                  >
                    <input
                      type="checkbox"
                      checked={
                        newConstraintColumnIds.includes(column.id)
                      }
                      onChange={() => toggleConstraintColumn(column.id)}
                      aria-label={`Include ${column.name} in unique constraint`}
                    />
                    <span className="constraint-checkbox-text">
                      {column.name}
                    </span>
                  </label>
                ))}
                <button
                  type="button"
                  className="save-constraint"
                  onClick={() =>
                    editingConstraint === 'new'
                      ? addUniqueConstraint()
                      : saveConstraintEdit(editingConstraint as string)
                  }
                  disabled={
                    !newConstraintName.trim() ||
                    newConstraintColumnIds.length === 0
                  }
                >
                  Save
                </button>
                <button
                  type="button"
                  className="cancel-constraint"
                  onClick={cancelConstraintEdit}
                >
                  Cancel
                </button>
              </div>
            ) : null}
            <ul className="constraint-list">
              {uniqueConstraints.map((constraint) => {
                const columnNames = table.columns
                  .filter((c) => constraint.columnIds.includes(c.id))
                  .map((c) => c.name)
                  .join(', ');
                return (
                  <li key={constraint.id} className="constraint-item">
                    <span className="constraint-name">
                      {constraint.name || 'Unnamed constraint'}
                    </span>
                    <span className="constraint-columns">
                      on {columnNames}
                    </span>
                    {editingConstraint === constraint.id ? null : (
                      <>
                        <button
                          type="button"
                          className="edit-constraint"
                          onClick={() => startConstraintEdit(constraint.id)}
                          aria-label={`Edit unique constraint ${constraint.name || constraint.id}`}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="remove-constraint"
                          onClick={() => removeUniqueConstraint(constraint.id)}
                          aria-label={`Remove unique constraint ${constraint.name || constraint.id}`}
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
              className="add-constraint"
              onClick={() => {
                setNewConstraintName('');
                setNewConstraintColumnIds([]);
                setEditingConstraint('new');
              }}
              aria-label="Add a new unique constraint to this table"
            >
              + Add unique constraint
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
      <div
        data-testid="table-resize-handle"
        className="table-resize-handle resize-handle"
        onMouseDown={handleResizeMouseDown}
        onPointerDown={handleResizeStart}
        aria-label="Resize table"
        role="button"
        aria-roledescription="resize handle"
      />
    </div>
  );
}
