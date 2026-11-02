import { useCallback, useState } from 'react';
import {
  createEmptyDiagram,
  Diagram,
  Relationship,
  Table,
} from '../types/diagram';

interface UseDiagramReturn {
  diagram: Diagram;
  createNewDiagram: (name?: string) => void;
  setDiagram: (diagram: Diagram) => void;
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
}

export function useDiagram(initialName?: string): UseDiagramReturn {
  const [diagram, setDiagram] = useState<Diagram>(() =>
    createEmptyDiagram(initialName),
  );

  const createNewDiagram = useCallback((name?: string) => {
    setDiagram(createEmptyDiagram(name));
  }, []);

  const loadDiagram = useCallback((next: Diagram) => {
    setDiagram(next);
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

  return {
    diagram,
    createNewDiagram,
    setDiagram: loadDiagram,
    addTable,
    removeTable,
    updateTable,
    addRelationship,
    removeRelationship,
    updateTablePosition,
  };
}
