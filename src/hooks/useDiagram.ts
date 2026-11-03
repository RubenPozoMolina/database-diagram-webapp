import { useCallback, useState } from 'react';
import {
  createEmptyDiagram,
  createIndex,
  Diagram,
  Index,
  Relationship,
  Table,
} from '../types/diagram';

interface UseDiagramReturn {
  diagram: Diagram;
  createNewDiagram: (name?: string) => void;
  addTable: (table: Omit<Table, 'id'>) => void;
  removeTable: (tableId: string) => void;
  updateTable: (
    tableId: string,
    updates: Partial<Omit<Table, 'id'>>,
  ) => void;
  addRelationship: (relationship: Omit<Relationship, 'id'>) => void;
  removeRelationship: (relationshipId: string) => void;
  updateTablePosition: (
    tableId: string,
    position: { x: number; y: number },
  ) => void;
  addIndex: (tableId: string, index: Omit<Index, 'id'>) => void;
  removeIndex: (tableId: string, indexId: string) => void;
  updateIndex: (
    tableId: string,
    indexId: string,
    updates: Partial<Omit<Index, 'id'>>,
  ) => void;
}

export function useDiagram(initialName?: string): UseDiagramReturn {
  const [diagram, setDiagram] = useState<Diagram>(() =>
    createEmptyDiagram(initialName),
  );

  const createNewDiagram = useCallback((name?: string) => {
    setDiagram(createEmptyDiagram(name));
  }, []);

  const addTable = useCallback(
    (table: Omit<Table, 'id'>) => {
      const newTable: Table = { ...table, id: crypto.randomUUID() };
      setDiagram((prev) => ({
        ...prev,
        tables: [...prev.tables, newTable],
      }));
    },
    [],
  );

  const updateTable = useCallback(
    (tableId: string, updates: Partial<Omit<Table, 'id'>>) => {
      setDiagram((prev) => ({
        ...prev,
        tables: prev.tables.map((t) =>
          t.id === tableId ? { ...t, ...updates } : t,
        ),
      }));
    },
    [],
  );

  const removeTable = useCallback((tableId: string) => {
    setDiagram((prev) => {
      const tables = prev.tables.filter((t) => t.id !== tableId);
      const relationships = prev.relationships.filter(
        (r) => r.sourceTableId !== tableId && r.targetTableId !== tableId,
      );
      return { ...prev, tables, relationships };
    });
  }, []);

  const addRelationship = useCallback(
    (relationship: Omit<Relationship, 'id'>) => {
      const newRelationship: Relationship = {
        ...relationship,
        id: crypto.randomUUID(),
      };
      setDiagram((prev) => ({
        ...prev,
        relationships: [...prev.relationships, newRelationship],
      }));
    },
    [],
  );

  const removeRelationship = useCallback((relationshipId: string) => {
    setDiagram((prev) => ({
      ...prev,
      relationships: prev.relationships.filter((r) => r.id !== relationshipId),
    }));
  }, []);

  const updateTablePosition = useCallback(
    (tableId: string, position: { x: number; y: number }) => {
      setDiagram((prev) => ({
        ...prev,
        tables: prev.tables.map((t) =>
          t.id === tableId ? { ...t, x: position.x, y: position.y } : t,
        ),
      }));
    },
    [],
  );

  const addIndex = useCallback(
    (tableId: string, index: Omit<Index, 'id'>) => {
      const newIndex: Index = createIndex(crypto.randomUUID(), index.name, index.columnId);
      setDiagram((prev) => ({
        ...prev,
        tables: prev.tables.map((t) =>
          t.id === tableId
            ? { ...t, indexes: [...t.indexes, newIndex] }
            : t,
        ),
      }));
    },
    [],
  );

  const removeIndex = useCallback(
    (tableId: string, indexId: string) => {
      setDiagram((prev) => ({
        ...prev,
        tables: prev.tables.map((t) =>
          t.id === tableId
            ? { ...t, indexes: t.indexes.filter((i) => i.id !== indexId) }
            : t,
        ),
      }));
    },
    [],
  );

  const updateIndex = useCallback(
    (
      tableId: string,
      indexId: string,
      updates: Partial<Omit<Index, 'id'>>,
    ) => {
      setDiagram((prev) => ({
        ...prev,
        tables: prev.tables.map((t) =>
          t.id === tableId
            ? {
                ...t,
                indexes: t.indexes.map((i) =>
                  i.id === indexId ? { ...i, ...updates } : i,
                ),
              }
            : t,
        ),
      }));
    },
    [],
  );

  return {
    diagram,
    createNewDiagram,
    addTable,
    removeTable,
    updateTable,
    addRelationship,
    removeRelationship,
    updateTablePosition,
    addIndex,
    removeIndex,
    updateIndex,
  };
}
