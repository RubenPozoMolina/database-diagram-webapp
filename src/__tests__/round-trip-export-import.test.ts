/**
 * Export→import round-trip validation (TASK-071).
 *
 * For every fixture under test/fixtures/round-trip/:
 *   1. Deserialize the fixture into the in-memory Diagram model (the original).
 *   2. Export: serialize the diagram to the JSON export payload.
 *   3. Re-import: JSON.parse the export and deserialize it back into a Diagram.
 *   4. Compare the re-exported payload of the imported diagram against the
 *      re-exported payload of the original diagram: table names, columns,
 *      data types, primary keys, foreign keys with referential actions,
 *      unique constraints, indexes and canvas positions (x/y/width/height).
 *
 * Reports per-fixture pass/fail and an overall pass rate. 100% round-trip
 * fidelity is required for all fixtures (PRD US-2.3 success metric).
 *
 * The comparison is performed on the serialized exports rather than the raw
 * in-memory models because deserialization normalizes absent/optional fields
 * (e.g. `unique: false` → absent, `length: null` → absent, `name: null` →
 * synthetic `idx_<column>`). Serializing both sides re-applies the same
 * normalization, so any real data loss shows up as a mismatch.
 *
 * `createdAt`/`updatedAt` are regenerated on every serialize and are excluded
 * from the comparison.
 */

import { describe, it, expect, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import type { SerializedExport } from '../serialization/diagramSerializer';
import { deserializeJson } from '../serialization/diagramDeserializer';
import { serializeDiagram } from '../serialization/diagramSerializer';

const FIXTURES_DIR = path.resolve(__dirname, '../../test/fixtures/round-trip');

function listFixtureFiles(): string[] {
  return fs
    .readdirSync(FIXTURES_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort();
}

function loadFixture(fileName: string): SerializedExport {
  return JSON.parse(
    fs.readFileSync(path.join(FIXTURES_DIR, fileName), 'utf8'),
  ) as SerializedExport;
}

interface FieldFailure {
  /** Dot/bracket path into the serialized export, e.g. `diagram.tables[0].columns[1].length`. */
  path: string;
  expected: unknown;
  actual: unknown;
}

interface RoundTripResult {
  fileName: string;
  passed: boolean;
  failures: FieldFailure[];
}

function failOn(
  failures: FieldFailure[],
  path: string,
  expected: unknown,
  actual: unknown,
): void {
  failures.push({ path, expected, actual });
}

function compareValues(
  failures: FieldFailure[],
  path: string,
  expected: unknown,
  actual: unknown,
): void {
  if (expected === actual) {
    return;
  }
  // NaN !== NaN, but two NaNs are equivalent here.
  if (
    typeof expected === 'number' &&
    typeof actual === 'number' &&
    Number.isNaN(expected) &&
    Number.isNaN(actual)
  ) {
    return;
  }
  if (Array.isArray(expected) && Array.isArray(actual)) {
    if (expected.length !== actual.length) {
      failOn(failures, path, expected, actual);
      return;
    }
    for (let i = 0; i < expected.length; i++) {
      compareValues(failures, `${path}[${i}]`, expected[i], actual[i]);
    }
    return;
  }
  if (
    expected !== null &&
    actual !== null &&
    typeof expected === 'object' &&
    typeof actual === 'object'
  ) {
    const expectedKeys = Object.keys(expected);
    const actualKeys = Object.keys(actual);
    const allKeys = new Set([...expectedKeys, ...actualKeys]);
    for (const key of allKeys) {
      compareValues(
        failures,
        `${path}.${key}`,
        (expected as Record<string, unknown>)[key],
        (actual as Record<string, unknown>)[key],
      );
    }
    return;
  }
  failOn(failures, path, expected, actual);
}

/**
 * Compares two serialized exports for structural and layout equality.
 * `createdAt`/`updatedAt` are intentionally excluded (regenerated per serialize).
 */
function compareSerializedExports(
  failures: FieldFailure[],
  expected: SerializedExport,
  actual: SerializedExport,
): void {
  compareValues(failures, 'version', expected.version, actual.version);
  const ed = expected.diagram;
  const ad = actual.diagram;
  compareValues(failures, 'diagram.id', ed.id, ad.id);
  compareValues(failures, 'diagram.name', ed.name, ad.name);
  compareValues(failures, 'diagram.tables', ed.tables, ad.tables);
  compareValues(failures, 'diagram.relationships', ed.relationships, ad.relationships);
  compareValues(failures, 'diagram.uniqueConstraints', ed.uniqueConstraints, ad.uniqueConstraints);
  compareValues(failures, 'diagram.indexes', ed.indexes, ad.indexes);
}

describe('export→import round-trip validation (TASK-071)', () => {
  const fixtures = listFixtureFiles();
  const results: RoundTripResult[] = [];

  it.each(fixtures)('export→import round-trip preserves %s', (fileName) => {
    const fixture = loadFixture(fileName);

    // Original in-memory diagram (deserialized from the fixture).
    const original = deserializeJson(fixture);

    // Export: serialize the diagram to the JSON export payload.
    const exportPayload = serializeDiagram(original);
    const json = JSON.stringify(exportPayload);

    // Re-import: parse the JSON and deserialize back into the model.
    const imported = deserializeJson(JSON.parse(json));

    // Re-export the imported diagram and compare both serializations.
    const failures: FieldFailure[] = [];
    compareSerializedExports(failures, exportPayload, serializeDiagram(imported));

    results.push({ fileName, passed: failures.length === 0, failures });

    expect(failures).toEqual([]);
  });

  afterAll(() => {
    const total = results.length;
    const passed = results.filter((r) => r.passed).length;
    const passRate = total === 0 ? 0 : (passed / total) * 100;
    // eslint-disable-next-line no-console
    console.log('\n--- TASK-071 Export→Import Round-Trip Validation Summary ---');
    for (const { fileName, passed, failures } of results) {
      // eslint-disable-next-line no-console
      console.log(
        `${passed ? 'PASS' : 'FAIL'} ${fileName}` +
          (failures.length > 0
            ? `  (${failures.length} failure(s): ${failures.map((f) => f.path).join(', ')})`
            : ''),
      );
    }
    // eslint-disable-next-line no-console
    console.log(
      `Overall: ${passed}/${total} fixtures passed (${passRate.toFixed(1)}% round-trip fidelity).`,
    );
    // eslint-disable-next-line no-console
    console.log('--- End TASK-071 Summary ---\n');
  });
});
