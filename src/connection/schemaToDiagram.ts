/**
 * Converts a structured read-schema response into a diagram model.
 *
 * Used by TASK-058 / STORY-017: once the frontend receives the schema data
 * from the backend read-schema endpoint, the tables, columns, primary keys,
 * foreign keys, unique constraints and indexes are translated into the
 * diagram data model so the canvas can render them.
 *
 * Tables are auto-arranged in a grid so the imported diagram is immediately
 * readable. Foreign keys become relationship lines between tables.
 */

import type { ReadSchemaResponse } from './readSchemaApi';
import type { Column, Diagram, Table } from '../types/diagram';
import {
  createColumn,
  createIndex,
  createRelationship,
  createTable,
  createUniqueConstraint,
} from '../types/diagram';

const DIAGRAM_NAME = 'Imported Schema';
const TABLE_WIDTH = 240;
const TABLE_MIN_HEIGHT = 120;
const ROW_HEIGHT = 150;
const H_GAP = 40;
const START_X = 100;
const START_Y = 100;
const COLUMNS_PER_ROW = 4;

interface TableBuild {
  table: Table;
  columnIdByName: Map<string, string>;
}

/**
 * Translates a read-schema response into a Diagram ready for rendering.
 *
 * Columns are marked as primary keys when they belong to a table primary-key
 * constraint. Foreign keys become diagram relationships, mapping the source
 * and target columns when those columns exist in the imported schema.
 */
export function schemaToDiagram(response: ReadSchemaResponse): Diagram {
  const diagram: Diagram = {
    id: crypto.randomUUID(),
    name: DIAGRAM_NAME,
    tables: [],
    relationships: [],
    uniqueConstraints: [],
  };

  const tableIdByName = new Map<string, string>();
  const tableBuilds = new Map<string, TableBuild>();

  // First pass: create tables and columns.
  response.tables.forEach((table, tableIndex) => {
    const tableId = crypto.randomUUID();
    tableIdByName.set(table.name, tableId);

    const columnIdByName = new Map<string, string>();
    const columns: Column[] = table.columns.map((column) => {
      const columnId = crypto.randomUUID();
      columnIdByName.set(column.name, columnId);
      return createColumn(
        columnId,
        column.name,
        column.dataType,
        column.isNullable,
        column.columnDefault ?? undefined,
        table.primaryKeys.some((primaryKey) =>
          primaryKey.columns.includes(column.name),
        ),
      );
    });

    const row = Math.floor(tableIndex / COLUMNS_PER_ROW);
    const columnIndex = tableIndex % COLUMNS_PER_ROW;
    const x = START_X + columnIndex * (TABLE_WIDTH + H_GAP);
    const y = START_Y + row * ROW_HEIGHT;
    const height = Math.max(TABLE_MIN_HEIGHT, 48 + table.columns.length * 26);

    tableBuilds.set(table.name, {
      table: createTable(tableId, table.name, x, y, TABLE_WIDTH, height, columns),
      columnIdByName,
    });
  });

  // Second pass: indexes, unique constraints and relationships.
  response.tables.forEach((table) => {
    const build = tableBuilds.get(table.name);
    if (!build) {
      return;
    }

    const { table: tableNode, columnIdByName } = build;

    tableNode.indexes = table.indexes.map((index) => {
      const columnId =
        index.columns.length > 0 ? columnIdByName.get(index.columns[0]) : undefined;
      return createIndex(crypto.randomUUID(), index.name, columnId ?? '');
    });

    table.uniqueConstraints.forEach((uniqueConstraint) => {
      const columnIds = uniqueConstraint.columns
        .map((name) => columnIdByName.get(name))
        .filter((id): id is string => Boolean(id));
      diagram.uniqueConstraints.push(
        createUniqueConstraint(
          crypto.randomUUID(),
          tableNode.id,
          columnIds,
          uniqueConstraint.constraintName,
        ),
      );
    });

    const sourceTableId = tableIdByName.get(table.name);
    table.foreignKeys.forEach((foreignKey) => {
      const targetTableId = tableIdByName.get(foreignKey.foreignTable);
      if (!targetTableId) {
        return;
      }
      const targetBuild = tableBuilds.get(foreignKey.foreignTable);
      diagram.relationships.push(
        createRelationship(
          crypto.randomUUID(),
          sourceTableId ?? '',
          columnIdByName.get(foreignKey.column),
          targetTableId,
          targetBuild?.columnIdByName.get(foreignKey.foreignColumn),
        ),
      );
    });
  });

  diagram.tables = Array.from(tableBuilds.values()).map((build) => build.table);
  return diagram;
}
