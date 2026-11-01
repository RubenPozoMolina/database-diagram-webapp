import { useState } from "react";

export type Table = {
  id: string;
  name: string;
  x: number;
  y: number;
  columns: Column[];
};

export type Column = {
  id: string;
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
  defaultValue: string | null;
};

export type Relationship = {
  id: string;
  sourceTableId: string;
  sourceColumnId: string;
  targetTableId: string;
  targetColumnId: string;
};

export type Diagram = {
  tables: Table[];
  relationships: Relationship[];
};

export type AppState = {
  diagram: Diagram;
};

export const initialState: AppState = {
  diagram: {
    tables: [],
    relationships: []
  }
};

function App() {
  const [state, setState] = useState<AppState>(initialState);

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
