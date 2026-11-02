import { useEffect, useRef, useState } from 'react';
import { useDiagram } from './hooks/useDiagram';
import { DiagramCanvas } from './components/DiagramCanvas';
import { ExportButton } from './components/ExportButton';
import { ConnectionForm } from './connection/ConnectionForm';
import { CreateTableModal } from './components/CreateTableModal';
import type { Column, Table } from './types/diagram';

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 800;
const TABLE_DEFAULT_WIDTH = 240;

export function App() {
  const {
    diagram,
    createNewDiagram,
    addTable,
    updateTable,
    updateTablePosition,
  } = useDiagram();

  const connectionFormRef = useRef<HTMLDivElement | null>(null);
  const connectionFormRefInstance = useRef<ConnectionForm | null>(null);
  const [isAddTableModalOpen, setIsAddTableModalOpen] = useState(false);

  useEffect(() => {
    const container = connectionFormRef.current;
    if (!container) return;

    const form = new ConnectionForm({ container });
    connectionFormRefInstance.current = form;

    return () => {
      form.destroy();
      connectionFormRefInstance.current = null;
    };
  }, []);

  const handleNewDiagram = () => {
    createNewDiagram();
  };

  const handleTablePositionUpdate = (
    id: string,
    x: number,
    y: number,
  ) => {
    updateTablePosition(id, { x, y });
  };

  const handleAddTable = () => {
    setIsAddTableModalOpen(true);
  };

  const handleCreateTable = (table: { name: string; columns: Column[] }) => {
    const offset = diagram.tables.length * 30;
    addTable({
      name: table.name,
      x: 100 + offset,
      y: 100 + offset,
      width: TABLE_DEFAULT_WIDTH,
      height: Math.max(120, 48 + table.columns.length * 26),
      columns: table.columns,
    });
    setIsAddTableModalOpen(false);
  };

  const handleTableUpdate = (
    id: string,
    updates: Partial<Omit<Table, 'id'>>,
  ) => {
    updateTable(id, updates);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">Database Diagram</h1>
        <div className="app-actions">
          <button
            type="button"
            className="add-table-button"
            onClick={handleAddTable}
            aria-label="Add a new table to the canvas"
          >
            Add Table
          </button>
          <button
            type="button"
            className="new-diagram-button"
            onClick={handleNewDiagram}
            aria-label="Create a new empty diagram"
          >
            New Diagram
          </button>
          <ExportButton diagram={diagram} />
        </div>
      </header>
      <main className="app-main">
        <section className="connection-panel">
          <div ref={connectionFormRef} id="connection-form" />
        </section>
        <div className="diagram-canvas-container">
          <DiagramCanvas
            diagram={diagram}
            onTablePositionUpdate={handleTablePositionUpdate}
            onTableUpdate={handleTableUpdate}
            style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
          />
          {isAddTableModalOpen && (
            <CreateTableModal
              isOpen
              onClose={() => setIsAddTableModalOpen(false)}
              onCreate={handleCreateTable}
            />
          )}
        </div>
      </main>
    </div>
  );
}
