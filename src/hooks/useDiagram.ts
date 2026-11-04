import { useCallback, useState } from 'react';
import {
  Column,
  createColumn,
  createEmptyDiagram,
  createIndex,
  createUniqueConstraint,
  Diagram,
  Index,
  Relationship,
  Table,
  UniqueConstraint,
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
  addIndex: (tableId: string, index: Omit<Index, 'id'>) => void;
  removeIndex: (tableId: string, indexId: string) => void;
  updateIndex: (
    tableId: string,
    indexId: string,
    updates: Partial<Omit<Index, 'id'>>,
  ) => void;
  addUniqueConstraint: (
    tableId: string,
    columnIds: string[],
    name?: string,
  ) => void;
  removeUniqueConstraint: (constraintId: string) => void;
  addColumn: (tableId: string, column: Omit<Column, 'id'>) => void;
  removeColumn: (tableId: string, columnId: string) => void;
  updateColumn: (
    tableId: string,
    columnId: string,
    updates: Partial<Omit<Column, 'id'>>,
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
      const uniqueConstraints = prev.uniqueConstraints.filter(
        (uc) => uc.tableId !== tableId,
      );
      return { ...prev, tables, relationships, uniqueConstraints };
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

  const addUniqueConstraint = useCallback(
    (tableId: string, columnIds: string[], name?: string) => {
      const newConstraint: UniqueConstraint = createUniqueConstraint(
        crypto.randomUUID(),
        tableId,
        columnIds,
        name,
      );
      setDiagram((prev) => ({
        ...prev,
        uniqueConstraints: [...prev.uniqueConstraints, newConstraint],
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

  const removeUniqueConstraint = useCallback((constraintId: string) => {
    setDiagram((prev) => ({
      ...prev,
      uniqueConstraints: prev.uniqueConstraints.filter(
        (uc) => uc.id !== constraintId,
      ),
    }));
  }, []);

  const addColumn = useCallback(
    (tableId: string, column: Omit<Column, 'id'>) => {
      const newColumn: Column = createColumn(
        crypto.randomUUID(),
        column.name,
        column.dataType,
        column.nullable,
        column.defaultValue,
        column.primaryKey,
      );
      setDiagram((prev) => ({
        ...prev,
        tables: prev.tables.map((t) =>
          t.id === tableId
            ? { ...t, columns: [...t.columns, newColumn] }
            : t,
        ),
      }));
    },
    [],
  );

  const removeColumn = useCallback(
    (tableId: string, columnId: string) => {
      setDiagram((prev) => ({
        ...prev,
        tables: prev.tables.map((t) =>
          t.id === tableId
            ? {
                ...t,
                columns: t.columns.filter((c) => c.id !== columnId),
                indexes: t.indexes.filter((i) => i.columnId !== columnId),
              }
            : t,
        ),
        uniqueConstraints: prev.uniqueConstraints.map((uc) =>
          uc.tableId === tableId
            ? {
                ...uc,
                columnIds: uc.columnIds.filter((cid) => cid !== columnId),
              }
            : uc,
        ),
      }));
    },
    [],
  );

  const updateColumn = useCallback(
    (
      tableId: string,
      columnId: string,
      updates: Partial<Omit<Column, 'id'>>,
    ) => {
      setDiagram((prev) => ({
        ...prev,
        tables: prev.tables.map((t) =>
          t.id === tableId
            ? {
                ...t,
                columns: t.columns.map((c) =>
                  c.id === columnId ? { ...c, ...updates } : c,
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
    setDiagram: loadDiagram,
    addTable,
    removeTable,
    updateTable,
    addRelationship,
    removeRelationship,
    updateTablePosition,
    addIndex,
    removeIndex,
    updateIndex,
    addUniqueConstraint,
    removeUniqueConstraint,
    addColumn,
    removeColumn,
    updateColumn,
  };
}
