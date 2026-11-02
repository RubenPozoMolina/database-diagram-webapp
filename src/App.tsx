import { useCallback } from 'react';
import { useDiagram } from './hooks/useDiagram';
import { DiagramCanvas } from './components/DiagramCanvas';
import type { Table } from './types/diagram';

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 800;

export function App() {
  const {
    diagram,
    createNewDiagram,
    addTable,
    updateTablePosition,
    updateTable,
  } = useDiagram();

  const handleNewDiagram = () => {
    createNewDiagram();
  };

  const handleAddTable = () => {
    const offset = diagram.tables.length * 40;
    addTable({
      name: `Table ${diagram.tables.length + 1}`,
      x: 50 + offset,
      y: 50 + offset,
      width: CANVAS_WIDTH / 6,
      height: 120,
      columns: [],
    });
  };

  const handleTablePositionUpdate = useCallback(
    (id: string, x: number, y: number) => {
      updateTablePosition(id, { x, y });
    },
    [updateTablePosition],
  );

  const handleTableUpdate = (table: Table) => {
    updateTable(table.id, {
      name: table.name,
      columns: table.columns,
      height: table.height,
    });
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">Database Diagram</h1>
        <div className="app-actions">
          <button
            type="button"
            className="new-diagram-button"
            onClick={handleNewDiagram}
            aria-label="Create a new empty diagram"
          >
            New Diagram
          </button>
          <button
            type="button"
            className="add-table-button"
            onClick={handleAddTable}
            aria-label="Add a new table to the canvas"
          >
            Add Table
          </button>
        </div>
      </header>
      <main className="app-main">
        <div className="diagram-canvas-container">
          <DiagramCanvas
            diagram={diagram}
            onTablePositionUpdate={handleTablePositionUpdate}
            onTableUpdate={handleTableUpdate}
            style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
          />
        </div>
      </main>
    </div>
  );
}
