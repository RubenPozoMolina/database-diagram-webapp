import { describe, it, expect } from "vitest";
import type { Diagram } from "../types/diagram";
import { serializeDiagram, deserializeDiagram, hasCredentials, DIAGRAM_JSON_VERSION } from "../index";

describe("diagram serializer", () => {
  it("serializes and deserializes a diagram without data loss", () => {
    const original: Diagram = {
      id: "diag-1",
      name: "Test Diagram",
      tables: [
        {
          id: "tbl-1",
          name: "users",
          x: 100,
          y: 100,
          width: 200,
          height: 150,
          columns: [
            {
              id: "col-1",
              name: "id",
              type: "serial",
              length: null,
              nullable: false,
              primaryKey: true,
              unique: false,
              defaultValue: null,
              comment: null
            },
            {
              id: "col-2",
              name: "email",
              type: "varchar",
              length: 255,
              nullable: false,
              primaryKey: false,
              unique: true,
              defaultValue: null,
              comment: "User email address"
            }
          ]
        }
      ],
      relationships: [
        {
          id: "rel-1",
          sourceTableId: "tbl-1",
          sourceColumnId: "col-1",
          targetTableId: "tbl-2",
          targetColumnId: "col-3",
          onDelete: "cascade",
          onUpdate: "cascade"
        }
      ],
      uniqueConstraints: [],
      indexes: [],
      createdAt: "2026-11-01T00:00:00Z",
      updatedAt: "2026-11-01T00:00:00Z"
    };

    const json = serializeDiagram(original);
    expect(json.version).toBe(DIAGRAM_JSON_VERSION);

    const restored = deserializeDiagram(json);
    expect(restored).toEqual(original);
  });

  it("detects credential fields in JSON", () => {
    expect(hasCredentials({ host: "localhost" })).toBe(true);
    expect(hasCredentials({ password: "secret" })).toBe(true);
    expect(hasCredentials({ name: "users" })).toBe(false);
    expect(hasCredentials({ tables: [] })).toBe(false);
  });

  it("rejects unsupported JSON version", () => {
    expect(() =>
      deserializeDiagram({
        version: "0.9.0",
        diagram: {
          id: "diag-1",
          name: "Test",
          tables: [],
          relationships: [],
          uniqueConstraints: [],
          indexes: [],
          createdAt: "2026-11-01T00:00:00Z",
          updatedAt: "2026-11-01T00:00:00Z"
        }
      } as never)
    ).toThrow(/Unsupported diagram JSON version/);
  });
});
