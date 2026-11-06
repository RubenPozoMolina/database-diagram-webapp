import { useCallback, useEffect, useRef, useState } from 'react';
import { useDiagram } from './hooks/useDiagram';
import { useConnection } from './hooks/useConnection';
import { DiagramCanvas } from './components/DiagramCanvas';
import { ExportButton } from './components/ExportButton';
import { ImportButton } from './components/ImportButton';
import { SchemaImportSelector } from './components/SchemaImportSelector';
import { DdlPreview } from './components/DdlPreview';
import { ConnectionForm } from './connection/ConnectionForm';
import { CreateTableModal } from './components/CreateTableModal';
import { CreateRelationshipModal } from './components/CreateRelationshipModal';
import type { Column, Diagram, Table, UniqueConstraint } from './types/diagram';
import type { ConnectionConfig, ConnectionResult } from './types';

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 800;
const TABLE_DEFAULT_WIDTH = 240;

export function App() {
  const {
    diagram,
    createNewDiagram,
    setDiagram,
    addTable,
    addRelationship,
    addUniqueConstraint,
    updateTable,
    updateTablePosition,
    removeTable,
    removeRelationship,
    addColumn,
    removeColumn,
    updateColumn,
    removeUniqueConstraint,
    updateUniqueConstraint,
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
  const [isAddRelationshipModalOpen, setIsAddRelationshipModalOpen] = useState(false);
  const [columnPositions, setColumnPositions] = useState<
    Map<string, Map<string, { x: number; y: number }>>
  >(new Map());
  const [importError, setImportErrorState] = useState<string | null>(null);

  const handleImportError = useCallback((message: string) => {
    setImportErrorState(message);
  }, []);

  const [isDdlPreviewOpen, setIsDdlPreviewOpen] = useState(false);
  const [ddlApplyMessage, setDdlApplyMessage] = useState<string | null>(null);
  const [ddlApplyError, setDdlApplyError] = useState<string | null>(null);

  const handleConnect = useCallback(
    async (
      connectionConfig: ConnectionConfig,
    ): Promise<ConnectionResult> => {
      return connect(connectionConfig);
    },
    [connect],
  );

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

  const handleColumnPositionUpdate = useCallback(
    (tableId: string, positions: Map<string, { x: number; y: number }>) => {
      setColumnPositions((prev) => {
        const next = new Map(prev);
        next.set(tableId, positions);
        return next;
      });
    },
    [],
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

  const handleAddRelationship = () => {
    setIsAddRelationshipModalOpen(true);
  };

  const handleCreateRelationship = (relationship: {
    sourceTableId: string;
    sourceColumnId: string;
    targetTableId: string;
    targetColumnId: string;
  }) => {
    addRelationship({
      sourceTableId: relationship.sourceTableId,
      sourceColumnId: relationship.sourceColumnId,
      targetTableId: relationship.targetTableId,
      targetColumnId: relationship.targetColumnId,
    });
    setIsAddRelationshipModalOpen(false);
  };

  const handleTableUpdate = (
    id: string,
    updates: Partial<Omit<Table, 'id'>>,
  ) => {
    updateTable(id, updates);
  };

  const handleDeleteTable = useCallback((tableId: string) => {
    removeTable(tableId);
  }, [removeTable]);

  const handleDeleteRelationship = useCallback(
    (relationshipId: string) => {
      removeRelationship(relationshipId);
    },
    [removeRelationship],
  );

  const handleAddColumn = useCallback(
    (tableId: string, column: Omit<Column, 'id'>) => {
      addColumn(tableId, column);
    },
    [addColumn],
  );

  const handleRemoveColumn = useCallback(
    (tableId: string, columnId: string) => {
      removeColumn(tableId, columnId);
    },
    [removeColumn],
  );

  const handleUpdateColumn = useCallback(
    (
      tableId: string,
      columnId: string,
      updates: Partial<Omit<Column, 'id'>>,
    ) => {
      updateColumn(tableId, columnId, updates);
    },
    [updateColumn],
  );

  const handleAddUniqueConstraint = useCallback(
    (tableId: string, columnIds: string[], name?: string) => {
      addUniqueConstraint(tableId, columnIds, name);
    },
    [addUniqueConstraint],
  );

  const handleRemoveUniqueConstraint = useCallback(
    (constraintId: string) => {
      removeUniqueConstraint(constraintId);
    },
    [removeUniqueConstraint],
  );

  const handleUpdateUniqueConstraint = useCallback(
    (constraintId: string, updates: Partial<Omit<UniqueConstraint, 'id'>>) => {
      updateUniqueConstraint(constraintId, updates);
    },
    [updateUniqueConstraint],
  );


  const handleDdlExecute = useCallback((_ddl: string): void => {
    setIsDdlPreviewOpen(false);
    setDdlApplyMessage('Schema applied successfully');
  }, []);

  const handleDdlClose = useCallback((): void => {
    setIsDdlPreviewOpen(false);
    setDdlApplyMessage(null);
    setDdlApplyError(null);
  }, []);

  const dismissDdlApplyMessage = () => {
    setDdlApplyMessage(null);
    setDdlApplyError(null);
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
            className="add-table-button"
            onClick={handleAddRelationship}
            aria-label="Add a relationship between tables"
          >
            Add Relationship
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
              <SchemaImportSelector
                config={config}
                onImport={handleImport}
              />
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
        {ddlApplyError && (
          <div className="connection-status connection-status--error" role="alert" aria-live="polite">
            {ddlApplyError}
            <button
              type="button"
              onClick={dismissDdlApplyMessage}
              className="connection-status-dismiss"
              aria-label="Dismiss apply error"
            >
              ×
            </button>
          </div>
        )}
        {ddlApplyMessage && (
          <div className="connection-status connection-status--success" role="status" aria-live="polite">
            {ddlApplyMessage}
            <button
              type="button"
              onClick={dismissDdlApplyMessage}
              className="connection-status-dismiss"
              aria-label="Dismiss apply message"
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
        </section>
        <div className="diagram-canvas-container">
          <DiagramCanvas
            diagram={diagram}
            onTablePositionUpdate={handleTablePositionUpdate}
            onColumnPositionUpdate={handleColumnPositionUpdate}
            onTableUpdate={handleTableUpdate}
            onDeleteTable={handleDeleteTable}
            onDeleteRelationship={handleDeleteRelationship}
            onAddColumn={handleAddColumn}
            onRemoveColumn={handleRemoveColumn}
            onUpdateColumn={handleUpdateColumn}
            onAddUniqueConstraint={handleAddUniqueConstraint}
            onRemoveUniqueConstraint={handleRemoveUniqueConstraint}
            onUpdateUniqueConstraint={handleUpdateUniqueConstraint}
            columnPositions={columnPositions}
            style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
          />
          {isAddTableModalOpen && (
            <CreateTableModal
              isOpen
              onClose={() => setIsAddTableModalOpen(false)}
              onCreate={handleCreateTable}
            />
          )}
          {isAddRelationshipModalOpen && (
            <CreateRelationshipModal
              isOpen
              onClose={() => setIsAddRelationshipModalOpen(false)}
              tables={diagram.tables}
              onCreate={handleCreateRelationship}
            />
          )}
          {isDdlPreviewOpen && (
            <DdlPreview
              diagram={diagram}
              connection={config}
              isOpen={isDdlPreviewOpen}
              onClose={handleDdlClose}
              onExecute={handleDdlExecute}
            />
          )}
        </div>
      </main>
    </div>
  );
}
