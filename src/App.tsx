import { useEffect, useRef } from 'react';
import { useDiagram } from './hooks/useDiagram';
import { DiagramCanvas } from './components/DiagramCanvas';
import { ConnectionForm } from './connection/ConnectionForm';

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 800;

export function App() {
  const {
    diagram,
    createNewDiagram,
    updateTablePosition,
  } = useDiagram();

  const connectionFormRef = useRef<HTMLDivElement | null>(null);
  const connectionFormRefInstance = useRef<ConnectionForm | null>(null);

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
            style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
          />
        </div>
      </main>
    </div>
  );
}
