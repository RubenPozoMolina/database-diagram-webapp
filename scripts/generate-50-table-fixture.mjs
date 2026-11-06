/**
 * Generates a 50-table diagram JSON fixture for performance benchmarking.
 *
 * Produces test/fixtures/50-tables-diagram.json conforming to the canonical
 * JSON schema version 1.0.0 with 50 tables, columns, relationships, indexes
 * and unique constraints.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const TABLE_COUNT = 50;
const DIAGRAM_JSON_VERSION = '1.0.0';

let seed = 0;
function nextInt(max) {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed % max;
}

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (seed * 1103515245 + 12345) & 0x7fffffff;
    seed = (seed + 1) & 0x7fffffff;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const types = ['serial', 'integer', 'varchar', 'numeric', 'timestamp', 'text', 'boolean'];

const tables = [];
const relationships = [];
const uniqueConstraints = [];
const indexes = [];

for (let i = 0; i < TABLE_COUNT; i++) {
  const tableId = uuid();
  const colCount = 3 + nextInt(3); // 3-5 columns
  const columns = [];
  for (let j = 0; j < colCount; j++) {
    const colId = uuid();
    const isPK = j === 0;
    columns.push({
      id: colId,
      name: `col_${j}`,
      type: types[nextInt(types.length)],
      length: j === 1 ? 255 : null,
      nullable: j > 0,
      primaryKey: isPK,
      unique: j > 1 ? nextInt(2) === 0 : false,
      defaultValue: isPK ? 'CURRENT_TIMESTAMP' : null,
      comment: j === 2 ? 'auto-generated column' : null,
    });
  }
  tables.push({
    id: tableId,
    name: `table_${String(i + 1).padStart(3, '0')}`,
    x: 50 + (i % 10) * 260,
    y: 50 + Math.floor(i / 10) * 220,
    width: 240,
    height: 120 + colCount * 26,
    columns,
    indexes: [],
  });

  // Index on first non-PK column of every 3rd table.
  if (i % 3 === 0 && colCount > 1) {
    indexes.push({
      id: uuid(),
      tableId,
      columnIds: [columns[1].id],
      unique: false,
      name: `idx_${tableId}_col1`,
    });
  }

  // Unique constraint on second column of every 4th table.
  if (i % 4 === 0 && colCount > 1) {
    uniqueConstraints.push({
      id: uuid(),
      tableId,
      columnIds: [columns[1].id],
      name: `uc_${tableId}_col1`,
    });
  }
}

// Chain tables with relationships (table N -> table N+1).
for (let i = 0; i < TABLE_COUNT - 1; i++) {
  const sourceTable = tables[i];
  const targetTable = tables[i + 1];
  const sourcePk = sourceTable.columns.find((c) => c.primaryKey);
  const targetPk = targetTable.columns.find((c) => c.primaryKey);
  if (sourcePk && targetPk) {
    relationships.push({
      id: uuid(),
      sourceTableId: sourceTable.id,
      sourceColumnId: sourcePk.id,
      targetTableId: targetTable.id,
      targetColumnId: targetPk.id,
      onDelete: 'cascade',
      onUpdate: 'cascade',
    });
  }
}

// Add a few extra cross relationships.
for (let i = 0; i < 10; i++) {
  const srcIdx = nextInt(TABLE_COUNT);
  const tgtIdx = nextInt(TABLE_COUNT);
  if (srcIdx !== tgtIdx) {
    const sourceTable = tables[srcIdx];
    const targetTable = tables[tgtIdx];
    const sourcePk = sourceTable.columns.find((c) => c.primaryKey);
    const targetPk = targetTable.columns.find((c) => c.primaryKey);
    if (sourcePk && targetPk) {
      relationships.push({
        id: uuid(),
        sourceTableId: sourceTable.id,
        sourceColumnId: sourcePk.id,
        targetTableId: targetTable.id,
        targetColumnId: targetPk.id,
        onDelete: 'no action',
        onUpdate: 'no action',
      });
    }
  }
}

const now = new Date().toISOString();
const payload = {
  version: DIAGRAM_JSON_VERSION,
  diagram: {
    id: uuid(),
    name: 'Performance Benchmark 50 Tables',
    tables,
    relationships,
    uniqueConstraints,
    indexes,
    createdAt: now,
    updatedAt: now,
  },
};

const outDir = join(process.cwd(), 'test', 'fixtures');
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, '50-tables-diagram.json');
writeFileSync(outPath, JSON.stringify(payload, null, 2));

console.log(`Wrote ${outPath}`);
console.log(`Tables: ${tables.length}`);
console.log(`Relationships: ${relationships.length}`);
console.log(`Unique constraints: ${uniqueConstraints.length}`);
console.log(`Indexes: ${indexes.length}`);
const totalColumns = tables.reduce((sum, t) => sum + t.columns.length, 0);
console.log(`Total columns: ${totalColumns}`);
console.log(`File size (bytes): ${Buffer.byteLength(JSON.stringify(payload), 'utf8')}`);
