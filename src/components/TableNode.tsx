import React, { useCallback } from 'react';
import type { Table } from '../types/diagram';

// Visual constants mirroring the canvas renderer so the editable table
// sizes itself to its content.
const HEADER_HEIGHT = 28;
const COLUMN_ROW_HEIGHT = 22;
const TABLE_PADDING = 12;
const TABLE_MIN_HEIGHT = 100;

interface TableNodeProps {
  table: Table;
  onUpdatePosition: (id: string, x: number, y: number) => void;
  onTableUpdate: (table: Table) => void;
}

export function TableNode({ table, onUpdatePosition, onTableUpdate }: TableNodeProps) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    onUpdatePosition(table.id, rect.left, rect.top);
  }, [table.id, table.width, table.height, onUpdatePosition]);

  const tableHeight = Math.max(
    TABLE_MIN_HEIGHT,
    HEADER_HEIGHT + table.columns.length * COLUMN_ROW_HEIGHT + TABLE_PADDING * 2,
  );

  const updateColumn = useCallback(
    (columnId: string, field: 'name' | 'dataType', value: string) => {
      const next = table.columns.map((column) =>
        column.id === columnId ? { ...column, [field]: value } : column,
      );
      onTableUpdate({ ...table, columns: next, height: tableHeight });
    },
    [table, onTableUpdate, tableHeight],
  );

  const removeColumn = useCallback(
    (columnId: string) => {
      const next = table.columns.filter((column) => column.id !== columnId);
      onTableUpdate({ ...table, columns: next, height: tableHeight });
    },
    [table, onTableUpdate, tableHeight],
  );

  const addColumn = useCallback(() => {
    const next = [
      ...table.columns,
      {
        id: crypto.randomUUID(),
        name: 'new_column',
        dataType: 'text',
        nullable: true,
        primaryKey: false,
      },
    ];
    onTableUpdate({ ...table, columns: next, height: tableHeight + COLUMN_ROW_HEIGHT });
  }, [table, onTableUpdate, tableHeight]);

  return (
    <div
      ref={ref}
      className="table-node"
      style={{
        left: table.x,
        top: table.y,
        width: table.width,
        height: tableHeight,
      }}
    >
      <div className="table-header">{table.name}</div>
      <div className="table-columns">
        {table.columns.map((column) => (
          <div key={column.id} className="table-column-row">
            <input
              type="text"
              className="table-column-input"
              value={column.name}
              onChange={(event) =>
                updateColumn(column.id, 'name', event.target.value)
              }
              aria-label="Column name"
            />
            <span className="table-column-separator">:</span>
            <input
              type="text"
              className="table-column-input"
              value={column.dataType}
              onChange={(event) =>
                updateColumn(column.id, 'dataType', event.target.value)
              }
              aria-label="Data type"
            />
            <button
              type="button"
              className="remove-column-button"
              onClick={() => removeColumn(column.id)}
              aria-label="Remove column"
            >
              &times;
            </button>
          </div>
        ))}
        <button
          type="button"
          className="add-column-button"
          onClick={addColumn}
          aria-label="Add column"
        >
          + Add column
        </button>
      </div>
    </div>
  );
}
