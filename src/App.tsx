import { useCallback, useEffect, useRef, useState } from 'react';
import { useDiagram } from './hooks/useDiagram';
import { useConnection } from './hooks/useConnection';
import { DiagramCanvas } from './components/DiagramCanvas';
import { ExportButton } from './components/ExportButton';
import { ImportButton } from './components/ImportButton';
import { DdlPreview } from './components/DdlPreview';
import { ConnectionForm } from './connection/ConnectionForm';
import { CreateTableModal } from './components/CreateTableModal';
import { readSchema } from './connection/readSchemaApi';
import type { Column, Diagram, Table, UniqueConstraint } from './types/diagram';
import type { ConnectionConfig, ConnectionResult } from './types';
import type { ReadSchemaResponse } from './connection/readSchemaApi';

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 800;
const TABLE_DEFAULT_WIDTH = 240;

export function App() {
  const {
    diagram,
    createNewDiagram,
    setDiagram,
    addTable,
    addUniqueConstraint,
    updateTable,
    updateTablePosition,
  } = useDiagram();

  const {
    status,
    isConnected,
    config,
    error,
    message,
    connect,
    disconnect,
    clearMessage,
  } = useConnection();

  const connectionFormRef = useRef<HTMLDivElement | null>(null);
  const connectionFormRefInstance = useRef<ConnectionForm | null>(null);
  const [isAddTableModalOpen, setIsAddTableModalOpen] = useState(false);
  const [importError, setImportErrorState] = useState<string | null>(null);

  const handleImportError = useCallback((message: string) => {
    setImportErrorState(message);
  }, []);

  const [isDdlPreviewOpen, setIsDdlPreviewOpen] = useState(false);
  const [isImportingSchema, setIsImportingSchema] = useState(false);
  const [importSchemaError, setImportSchemaError] = useState<string | null>(null);
  const [importedSchema, setImportedSchema] = useState<ReadSchemaResponse | null>(null);

  const handleConnect = async (
    connectionConfig: ConnectionConfig,
  ): Promise<ConnectionResult> => {
    return connect(connectionConfig);
  };

  useEffect(() => {
    const container = connectionFormRef.current;
    if (!container) return;

    const form = new ConnectionForm({ container, submitConnection: handleConnect });
    connectionFormRefInstance.current = form;

    return () => {
      form.destroy();
      connectionFormRefInstance.current = null;
    };
  }, [handleConnect]);

  const handleNewDiagram = () => {
    createNewDiagram();
    setImportErrorState(null);
  };

  const handleImport = (importedDiagram: Diagram) => {
    setDiagram(importedDiagram);
    setImportErrorState(null);
  };

  const handleTablePositionUpdate = useCallback(
    (id: string, x: number, y: number) => {
      updateTablePosition(id, { x, y });
    },
    [updateTablePosition],
  );

  const handleAddTable = () => {
    setIsAddTableModalOpen(true);
  };

  const handleCreateTable = (table: {
    name: string;
    columns: Column[];
    uniqueConstraints: UniqueConstraint[];
  }) => {
    const offset = diagram.tables.length * 30;
    addTable({
      name: table.name,
      x: 100 + offset,
      y: 100 + offset,
      width: TABLE_DEFAULT_WIDTH,
      height: Math.max(120, 48 + table.columns.length * 26),
      columns: table.columns,
      indexes: [],
    });
    const newTable = diagram.tables.find((t) => t.name === table.name);
    if (newTable) {
      table.uniqueConstraints.forEach((uc) => {
        addUniqueConstraint(newTable.id, uc.columnIds, uc.name);
      });
    }
    setIsAddTableModalOpen(false);
  };

  const handleTableUpdate = (
    id: string,
    updates: Partial<Omit<Table, 'id'>>,
  ) => {
    updateTable(id, updates);
  };

  const handleImportSchema = async () => {
    if (!config) return;
    setIsImportingSchema(true);
    setImportSchemaError(null);
    try {
      const result = await readSchema(config);
      if (result.success) {
        setImportedSchema(result);
        setImportSchemaError(null);
      } else {
        setImportSchemaError(result.error);
      }
    } catch {
      setImportSchemaError('Unexpected error while importing schema');
    } finally {
      setIsImportingSchema(false);
    }
  };

  const dismissImportError = () => {
    setImportSchemaError(null);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">Database Diagram</h1>
        <div className="app-actions">
          {isConnected && (
            <button
              type="button"
              className="disconnect-button"
              onClick={disconnect}
              aria-label="Disconnect from database"
            >
              Disconnect
            </button>
          )}
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
          <ImportButton onImport={handleImport} onError={handleImportError} />
          {isConnected && config && (
            <>
              <button
                type="button"
                className="import-schema-button"
                onClick={handleImportSchema}
                disabled={isImportingSchema}
                aria-label="Import PostgreSQL schema as diagram"
              >
                {isImportingSchema ? 'Importing…' : 'Import Schema'}
              </button>
              <button
                type="button"
                className="export-button"
                onClick={() => setIsDdlPreviewOpen(true)}
                aria-label="Export diagram to PostgreSQL with DDL preview"
              >
                Export to PostgreSQL
              </button>
            </>
          )}
        </div>
        {status === 'connecting' && (
          <div className="connection-status connection-status--info" role="status" aria-live="polite">
            Connecting…
          </div>
        )}
        {status === 'connected' && message && (
          <div className="connection-status connection-status--success" role="status" aria-live="polite">
            {message}
          </div>
        )}
        {status === 'error' && error && (
          <div className="connection-status connection-status--error" role="status" aria-live="polite">
            {error}
            <button
              type="button"
              onClick={clearMessage}
              className="connection-status-dismiss"
              aria-label="Dismiss error message"
            >
              ×
            </button>
          </div>
        )}
        {importError && (
          <div className="connection-status connection-status--error" role="alert" aria-live="polite">
            {importError}
            <button
              type="button"
              onClick={() => setImportErrorState(null)}
              className="connection-status-dismiss"
              aria-label="Dismiss import error"
            >
              ×
            </button>
          </div>
        )}
        {importSchemaError && (
          <div className="connection-status connection-status--error" role="status" aria-live="polite">
            {importSchemaError}
            <button
              type="button"
              onClick={dismissImportError}
              className="connection-status-dismiss"
              aria-label="Dismiss import error"
            >
              ×
            </button>
          </div>
        )}
      </header>
      <main className="app-main">
        <section className="connection-panel">
          <h2>Database Connection</h2>
          <div ref={connectionFormRef} id="connection-form" />
          {config && (
            <div className="connection-info">
              Connected to {config.host}:{config.port}/{config.database} as {config.user}
            </div>
          )}
          {importedSchema && (
            <div className="schema-import-info" role="status" aria-live="polite">
              Imported schema '{importedSchema.schema}' with {importedSchema.tables.length} table(s).
            </div>
          )}
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
          {isDdlPreviewOpen && (
            <DdlPreview
              diagram={diagram}
              connection={config}
              isOpen={isDdlPreviewOpen}
              onClose={() => setIsDdlPreviewOpen(false)}
            />
          )}
        </div>
      </main>
    </div>
  );
}
