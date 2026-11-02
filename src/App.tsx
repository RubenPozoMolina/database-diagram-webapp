import { useDiagram } from './hooks/useDiagram';
import { DiagramCanvas } from './components/DiagramCanvas';
import { ExportButton } from './components/ExportButton';

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 800;

export function App() {
  const {
    diagram,
    createNewDiagram,
    updateTablePosition,
  } = useDiagram();

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
          <ExportButton diagram={diagram} />
        </div>
      </header>
      <main className="app-main">
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
