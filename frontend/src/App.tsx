import type { Diagram } from "./types/diagram";

export type AppState = {
  diagram: Diagram;
};

export const initialState: AppState = {
  diagram: {
    id: "initial",
    name: "New Diagram",
    tables: [],
    relationships: [],
    uniqueConstraints: [],
    indexes: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
};

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>Database Diagram</h1>
        <p>Visual database diagramming with JSON import/export and PostgreSQL integration.</p>
      </header>
      <main className="app-main">
        <canvas className="diagram-canvas" />
      </main>
    </div>
  );
}

export default App;
