import React from 'react';
import type { Column, Diagram, Table, UniqueConstraint } from '../types/diagram';
import { TableNode } from './TableNode';
import { RelationshipLine } from './RelationshipLine';
import { findUniqueConstraintsByTable } from '../types/diagram';

interface DiagramCanvasProps {
  diagram: Diagram;
  onTablePositionUpdate: (id: string, x: number, y: number) => void;
  onColumnPositionUpdate?: (
    tableId: string,
    columnPositions: Map<string, { x: number; y: number }>,
  ) => void;
  onTableUpdate: (id: string, updates: Partial<Omit<Table, 'id'>>) => void;
  onDeleteTable: (tableId: string) => void;
  onDeleteRelationship: (relationshipId: string) => void;
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
  columnPositions?: Map<string, Map<string, { x: number; y: number }>>;
  style?: React.CSSProperties;
}

const TABLE_DEFAULT_WIDTH = 220;
const TABLE_DEFAULT_HEIGHT = 120;

export function DiagramCanvas({
  diagram,
  onTablePositionUpdate,
  onColumnPositionUpdate,
  onTableUpdate,
  onDeleteTable,
  onDeleteRelationship,
  onAddColumn,
  onRemoveColumn,
  onUpdateColumn,
  onAddUniqueConstraint,
  onRemoveUniqueConstraint,
  onUpdateUniqueConstraint,
  columnPositions,
  style,
}: DiagramCanvasProps) {
  const lineEndpoints = React.useMemo(() => {
    const positions = new Map<string, { x: number; y: number }>();
    diagram.tables.forEach((table) => {
      positions.set(table.id, { x: table.x, y: table.y });
    });
    return positions;
  }, [diagram.tables]);

  return (
    <div className="diagram-canvas-wrapper" style={style}>
      <h2 className="diagram-title">{diagram.name}</h2>
      <svg
        className="diagram-svg"
        width="100%"
        height="100%"
        style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
      >
        {diagram.relationships.map((relationship) => {
          const source = lineEndpoints.get(relationship.sourceTableId);
          const target = lineEndpoints.get(relationship.targetTableId);
          if (!source || !target) return null;

          // Default endpoints: bottom-center of source table, top-center of target table.
          let sourceX = source.x + TABLE_DEFAULT_WIDTH / 2;
          let sourceY = source.y + TABLE_DEFAULT_HEIGHT;
          let targetX = target.x + TABLE_DEFAULT_WIDTH / 2;
          let targetY = target.y;

          // When column positions are available and the relationship references
          // specific columns, anchor the line to those columns instead of table centres.
          if (columnPositions && relationship.sourceColumnId) {
            const sourceColPos = columnPositions
              .get(relationship.sourceTableId)
              ?.get(relationship.sourceColumnId);
            if (sourceColPos) {
              sourceX = sourceColPos.x;
              sourceY = sourceColPos.y;
            }
          }
          if (columnPositions && relationship.targetColumnId) {
            const targetColPos = columnPositions
              .get(relationship.targetTableId)
              ?.get(relationship.targetColumnId);
            if (targetColPos) {
              targetX = targetColPos.x;
              targetY = targetColPos.y;
            }
          }

          return (
            <RelationshipLine
              key={relationship.id}
              relationship={relationship}
              sourceX={sourceX}
              sourceY={sourceY}
              targetX={targetX}
              targetY={targetY}
              onDelete={onDeleteRelationship}
            />
          );
        })}
      </svg>
      {diagram.tables.map((table) => (
        <TableNode
          key={table.id}
          table={table}
          uniqueConstraints={findUniqueConstraintsByTable(diagram, table.id)}
          onUpdatePosition={onTablePositionUpdate}
          onColumnPositionUpdate={onColumnPositionUpdate}
          onUpdateTable={onTableUpdate}
          onDeleteTable={onDeleteTable}
          onAddColumn={onAddColumn}
          onRemoveColumn={onRemoveColumn}
          onUpdateColumn={onUpdateColumn}
          onAddUniqueConstraint={onAddUniqueConstraint}
          onRemoveUniqueConstraint={onRemoveUniqueConstraint}
          onUpdateUniqueConstraint={onUpdateUniqueConstraint}
        />
      ))}
      {diagram.tables.length === 0 && (
        <div className="empty-canvas-message">
          Empty diagram canvas. Add tables and relationships to start designing.
        </div>
      )}
    </div>
  );
}
