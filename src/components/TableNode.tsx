import React from 'react';
import type { Table } from '../types/diagram';

interface TableNodeProps {
  table: Table;
  onUpdatePosition: (id: string, x: number, y: number) => void;
}

export function TableNode({ table, onUpdatePosition }: TableNodeProps) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    onUpdatePosition(table.id, rect.left, rect.top);
  }, [table.id, table.width, table.height, onUpdatePosition]);

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
    >
      <div className="table-header">{table.name}</div>
      <div className="table-columns">
        {table.columns.map((column) => (
          <div
            key={column.id}
            className="table-column"
            title={column.primaryKey ? 'PK' : ''}
          >
            {column.name}: {column.dataType}
          </div>
        ))}
      </div>
    </div>
  );
}
