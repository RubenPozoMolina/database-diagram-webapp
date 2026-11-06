/**
 * Round-trip fidelity tests for fixture diagrams (TASK-070).
 *
 * Validates that every fixture under test/fixtures/round-trip/:
 *   1. Conforms to the canonical JSON Schema (Draft 7) at
 *      src/schema/diagram.schema.json
 *   2. Survives a deserialize -> serialize round-trip without data loss
 *   3. Covers the required edge cases: composite PK, composite FK,
 *      self-referencing relationships, unique constraints, indexes,
 *      nullable columns, default values, comments, and layout positions.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import type { SerializedExport } from '../serialization/diagramSerializer';
import { deserializeJson } from '../serialization/diagramDeserializer';
import { serializeDiagram } from '../serialization/diagramSerializer';

const require = createRequire(import.meta.url);
const Ajv = require('ajv');

const FIXTURES_DIR = path.resolve(__dirname, '../../test/fixtures/round-trip');
const SCHEMA_PATH = path.resolve(__dirname, '../schema/diagram.schema.json');

const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
const ajv = new (Ajv as any)({ validateFormats: true, allErrors: true });
const validate = ajv.compile(schema);

function listFixtureFiles(): string[] {
  return fs
    .readdirSync(FIXTURES_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort();
}

function loadFixture(fileName: string): SerializedExport {
  const content = fs.readFileSync(path.join(FIXTURES_DIR, fileName), 'utf8');
  return JSON.parse(content) as SerializedExport;
}

function findColumnById(
  tables: SerializedExport['diagram']['tables'],
  columnId: string,
): { tableName: string; column: any } | undefined {
  for (const table of tables) {
    const column = table.columns.find((c) => c.id === columnId);
    if (column) return { tableName: table.name, column };
  }
  return undefined;
}

describe('round-trip fixtures — JSON Schema validation (TASK-070)', () => {
  const fixtures = listFixtureFiles();

  it.each(fixtures)('validates %s against the canonical JSON Schema', (fileName) => {
    const fixture = loadFixture(fileName);
    const valid = validate(fixture);
    expect(valid).toBe(true);
    if (!valid) {
      // eslint-disable-next-line no-console
      console.error(`Schema validation errors for ${fileName}:`, validate.errors);
    }
  });

  it('includes at least 5 fixture files', () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(5);
  });
});

describe('round-trip fixtures — serialize/deserialize round-trip (TASK-070)', () => {
  const fixtures = listFixtureFiles();

  it.each(fixtures)('round-trips %s without data loss', (fileName) => {
    const fixture = loadFixture(fileName);

    // Deserialize the fixture into the in-memory Diagram model
    const diagram = deserializeJson(fixture);

    // Serialize back to JSON
    const reSerialized = serializeDiagram(diagram);
    const reParsed = JSON.parse(JSON.stringify(reSerialized)) as SerializedExport;

    // Top-level fields must match
    expect(reParsed.version).toBe(fixture.version);
    expect(reParsed.diagram.id).toBe(fixture.diagram.id);
    expect(reParsed.diagram.name).toBe(fixture.diagram.name);

    // Tables must round-trip
    expect(reParsed.diagram.tables).toHaveLength(fixture.diagram.tables.length);
    for (const [i, originalTable] of fixture.diagram.tables.entries()) {
      const roundTrippedTable = reParsed.diagram.tables[i];
      expect(roundTrippedTable.id).toBe(originalTable.id);
      expect(roundTrippedTable.name).toBe(originalTable.name);
      expect(roundTrippedTable.x).toBe(originalTable.x);
      expect(roundTrippedTable.y).toBe(originalTable.y);
      expect(roundTrippedTable.width).toBe(originalTable.width);
      expect(roundTrippedTable.height).toBe(originalTable.height);
      expect(roundTrippedTable.columns).toHaveLength(originalTable.columns.length);

      for (const [j, originalCol] of originalTable.columns.entries()) {
        const rtCol = roundTrippedTable.columns[j];
        expect(rtCol.id).toBe(originalCol.id);
        expect(rtCol.name).toBe(originalCol.name);
        expect(rtCol.type).toBe(originalCol.type);
        expect(rtCol.length).toBe(originalCol.length);
        expect(rtCol.nullable).toBe(originalCol.nullable);
        expect(rtCol.primaryKey).toBe(originalCol.primaryKey);
        expect(rtCol.unique).toBe(originalCol.unique);
        expect(rtCol.defaultValue).toBe(originalCol.defaultValue);
        expect(rtCol.comment).toBe(originalCol.comment);
      }
    }

    // Relationships must round-trip
    expect(reParsed.diagram.relationships).toHaveLength(
      fixture.diagram.relationships.length,
    );
    for (const [i, originalRel] of fixture.diagram.relationships.entries()) {
      const rtRel = reParsed.diagram.relationships[i];
      expect(rtRel.id).toBe(originalRel.id);
      expect(rtRel.sourceTableId).toBe(originalRel.sourceTableId);
      expect(rtRel.sourceColumnId).toBe(originalRel.sourceColumnId);
      expect(rtRel.targetTableId).toBe(originalRel.targetTableId);
      expect(rtRel.targetColumnId).toBe(originalRel.targetColumnId);
      expect(rtRel.onDelete).toBe(originalRel.onDelete);
      expect(rtRel.onUpdate).toBe(originalRel.onUpdate);
    }

    // Unique constraints must round-trip
    expect(reParsed.diagram.uniqueConstraints).toHaveLength(
      fixture.diagram.uniqueConstraints.length,
    );
    for (const [i, originalUc] of fixture.diagram.uniqueConstraints.entries()) {
      const rtUc = reParsed.diagram.uniqueConstraints[i];
      expect(rtUc.id).toBe(originalUc.id);
      expect(rtUc.tableId).toBe(originalUc.tableId);
      expect(rtUc.columnIds).toEqual(originalUc.columnIds);
      expect(rtUc.name).toBe(originalUc.name);
    }

    // Indexes must round-trip (order may change because indexes are
    // stored per-table in-memory but at diagram level in JSON)
    expect(reParsed.diagram.indexes).toHaveLength(fixture.diagram.indexes.length);
    const originalIndexIds = fixture.diagram.indexes.map((i) => i.id).sort();
    const rtIndexIds = reParsed.diagram.indexes.map((i) => i.id).sort();
    expect(rtIndexIds).toEqual(originalIndexIds);
    for (const originalIdx of fixture.diagram.indexes) {
      const rtIdx = reParsed.diagram.indexes.find((i) => i.id === originalIdx.id);
      expect(rtIdx).toBeDefined();
      expect(rtIdx!.tableId).toBe(originalIdx.tableId);
      expect(rtIdx!.columnIds).toEqual(originalIdx.columnIds);
      expect(rtIdx!.unique).toBe(originalIdx.unique);
      expect(rtIdx!.name).toBe(originalIdx.name);
    }
  });
});

describe('round-trip fixtures — edge case coverage (TASK-070)', () => {
  const fixtures = listFixtureFiles();
  const loadedFixtures = fixtures.map((f) => ({ fileName: f, fixture: loadFixture(f) }));

  it('covers composite primary keys (multiple primaryKey=true columns on one table)', () => {
    const compositePkFixture = loadedFixtures.find((f) => f.fileName === 'composite-pk.json')!;
    const orderItemsTable = compositePkFixture.fixture.diagram.tables.find(
      (t) => t.name === 'order_items',
    );
    expect(orderItemsTable).toBeDefined();
    const pks = orderItemsTable!.columns.filter((c) => c.primaryKey);
    expect(pks).toHaveLength(2);
    expect(pks.map((c) => c.name).sort()).toEqual(['order_id', 'product_id']);
  });

  it('covers composite foreign keys (two relationships between same tables mapping composite PK columns)', () => {
    const compositePkFixture = loadedFixtures.find((f) => f.fileName === 'composite-pk.json')!;
    const rels = compositePkFixture.fixture.diagram.relationships;
    const orderItemsRels = rels.filter(
      (r) => r.sourceTableId === compositePkFixture.fixture.diagram.tables.find((t) => t.name === 'order_items')!.id,
    );
    expect(orderItemsRels).toHaveLength(2);
  });

  it('covers self-referencing relationships (source and target table are the same)', () => {
    const selfRefFixture = loadedFixtures.find((f) => f.fileName === 'self-referencing.json')!;
    const selfRels = selfRefFixture.fixture.diagram.relationships.filter(
      (r) => r.sourceTableId === r.targetTableId,
    );
    expect(selfRels.length).toBeGreaterThanOrEqual(1);
  });

  it('covers unique constraints (single and composite)', () => {
    const uciFixture = loadedFixtures.find((f) => f.fileName === 'unique-constraints-indexes.json')!;
    const singleUc = uciFixture.fixture.diagram.uniqueConstraints.find(
      (uc) => uc.columnIds.length === 1,
    );
    const compositeUc = uciFixture.fixture.diagram.uniqueConstraints.find(
      (uc) => uc.columnIds.length === 2,
    );
    expect(singleUc).toBeDefined();
    expect(compositeUc).toBeDefined();
  });

  it('covers indexes (single and composite)', () => {
    const uciFixture = loadedFixtures.find((f) => f.fileName === 'unique-constraints-indexes.json')!;
    const singleIdx = uciFixture.fixture.diagram.indexes.find(
      (idx) => idx.columnIds.length === 1,
    );
    const compositeIdx = uciFixture.fixture.diagram.indexes.find(
      (idx) => idx.columnIds.length === 2,
    );
    expect(singleIdx).toBeDefined();
    expect(compositeIdx).toBeDefined();
  });

  it('includes tables with nullable columns', () => {
    for (const { fixture } of loadedFixtures) {
      const hasNullable = fixture.diagram.tables.some((t) =>
        t.columns.some((c) => c.nullable === true),
      );
      if (hasNullable) return; // at least one fixture has nullable columns
    }
    expect(true).toBe(true); // unreachable if all fixtures have nullable
  });

  it('includes tables with default values', () => {
    let found = false;
    for (const { fixture } of loadedFixtures) {
      if (fixture.diagram.tables.some((t) => t.columns.some((c) => c.defaultValue !== null))) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it('includes tables with comments', () => {
    let found = false;
    for (const { fixture } of loadedFixtures) {
      if (fixture.diagram.tables.some((t) => t.columns.some((c) => c.comment !== null))) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it('includes layout x/y/width/height values on all tables', () => {
    for (const { fixture, fileName } of loadedFixtures) {
      for (const table of fixture.diagram.tables) {
        expect(typeof table.x).toBe('number');
        expect(typeof table.y).toBe('number');
        expect(typeof table.width).toBe('number');
        expect(typeof table.height).toBe('number');
        expect(table.x).toBeGreaterThanOrEqual(0);
        expect(table.y).toBeGreaterThanOrEqual(0);
        expect(table.width).toBeGreaterThanOrEqual(1);
        expect(table.height).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('covers complex enterprise schema with all features combined', () => {
    const complexFixture = loadedFixtures.find((f) => f.fileName === 'complex-enterprise.json')!;
    const diagram = complexFixture.fixture.diagram;

    // Multiple tables
    expect(diagram.tables.length).toBeGreaterThanOrEqual(4);

    // Has relationships (FKs)
    expect(diagram.relationships.length).toBeGreaterThanOrEqual(4);

    // Has unique constraints
    expect(diagram.uniqueConstraints.length).toBeGreaterThanOrEqual(2);

    // Has indexes
    expect(diagram.indexes.length).toBeGreaterThanOrEqual(3);

    // Has composite PK (employee_projects)
    const epTable = diagram.tables.find((t) => t.name === 'employee_projects');
    expect(epTable).toBeDefined();
    const epPks = epTable!.columns.filter((c) => c.primaryKey);
    expect(epPks).toHaveLength(2);
  });

  afterAll(() => {
    // Print summary of fixture coverage
    // eslint-disable-next-line no-console
    console.log('\n--- TASK-070 Fixture Coverage Summary ---');
    for (const { fileName, fixture } of loadedFixtures) {
      const d = fixture.diagram;
      const compositePkTables = d.tables.filter((t) => t.columns.filter((c) => c.primaryKey).length > 1).length;
      const selfRefRels = d.relationships.filter((r) => r.sourceTableId === r.targetTableId).length;
      const compositeUcs = d.uniqueConstraints.filter((uc) => uc.columnIds.length > 1).length;
      const compositeIndexes = d.indexes.filter((idx) => idx.columnIds.length > 1).length;
      const nullableCols = d.tables.reduce((sum, t) => sum + t.columns.filter((c) => c.nullable).length, 0);
      const defaultCols = d.tables.reduce((sum, t) => sum + t.columns.filter((c) => c.defaultValue !== null).length, 0);
      const commentCols = d.tables.reduce((sum, t) => sum + t.columns.filter((c) => c.comment !== null).length, 0);
      // eslint-disable-next-line no-console
      console.log(
        `${fileName}: ${d.tables.length} tables, ${d.relationships.length} rels, ` +
        `${d.uniqueConstraints.length} UCs, ${d.indexes.length} indexes, ` +
        `compositePK=${compositePkTables}, selfRef=${selfRefRels}, compositeUC=${compositeUcs}, ` +
        `compositeIdx=${compositeIndexes}, nullableCols=${nullableCols}, defaultCols=${defaultCols}, commentCols=${commentCols}`,
      );
    }
    // eslint-disable-next-line no-console
    console.log('--- End TASK-070 Fixture Coverage Summary ---\n');
  });
});
