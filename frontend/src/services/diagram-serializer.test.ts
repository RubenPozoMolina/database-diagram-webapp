import { describe, it, expect } from "vitest";
import type { Diagram } from "../types/diagram";
import { serializeDiagram, deserializeDiagram, hasCredentials, DIAGRAM_JSON_VERSION, stripCredentials, CREDENTIAL_FIELDS } from "../index";

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

  describe("credential filtering", () => {
    it("stripCredentials removes credential fields from nested objects", () => {
      const dirty = {
        version: "1.0.0",
        diagram: {
          id: "abc",
          name: "My Diagram",
          host: "db.example.com",
          port: 5432,
          database: "mydb",
          user: "app_user",
          password: "s3cret",
          tables: [
            {
              id: "t1",
              name: "accounts",
              host: "injected-host",
              columns: [{ id: "c1", name: "id", password: "leaked-pw" }],
            },
          ],
        },
      };
      const cleaned = stripCredentials(dirty);
      const serialized = JSON.stringify(cleaned).toLowerCase();
      for (const field of CREDENTIAL_FIELDS) {
        expect(serialized).not.toContain(field);
      }
      // Non-credential data is preserved.
      expect(cleaned).toMatchObject({
        version: "1.0.0",
        diagram: { id: "abc", name: "My Diagram" },
      });
    });

    it("stripCredentials preserves arrays of non-credential objects", () => {
      const dirty = {
        items: [
          { name: "table-a", host: "bad" },
          { name: "table-b", password: "bad" },
        ],
      };
      const cleaned = stripCredentials(dirty);
      expect(cleaned).toEqual({
        items: [{ name: "table-a" }, { name: "table-b" }],
      });
    });

    it("serializeDiagram strips credentials even if injected into the diagram", () => {
      const diagram: Diagram = {
        id: "diag-1",
        name: "Tainted Diagram",
        tables: [],
        relationships: [],
        uniqueConstraints: [],
        indexes: [],
        createdAt: "2026-11-01T00:00:00Z",
        updatedAt: "2026-11-01T00:00:00Z"
      };
      // Simulate a future model extension that mistakenly carries credentials.
      (diagram as Record<string, unknown>).host = "db.example.com";
      (diagram as Record<string, unknown>).password = "s3cret";
      const result = serializeDiagram(diagram);
      const serialized = JSON.stringify(result).toLowerCase();
      for (const field of CREDENTIAL_FIELDS) {
        expect(serialized).not.toContain(field);
      }
      expect(result.diagram.name).toBe("Tainted Diagram");
    });

    it("serialized JSON contains no credential fields", () => {
      const diagram: Diagram = {
        id: "diag-1",
        name: "Clean Diagram",
        tables: [
          {
            id: "tbl-1",
            name: "accounts",
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
                comment: null,
              },
            ],
          },
        ],
        relationships: [],
        uniqueConstraints: [],
        indexes: [],
        createdAt: "2026-11-01T00:00:00Z",
        updatedAt: "2026-11-01T00:00:00Z"
      };
      const result = serializeDiagram(diagram);
      const serialized = JSON.stringify(result).toLowerCase();
      // Check credential fields as JSON keys (with quotes) to avoid
      // false positives from substring matches (e.g. "users" containing "user").
      for (const field of CREDENTIAL_FIELDS) {
        expect(serialized).not.toContain(`"${field}"`);
      }
      expect(result.diagram.name).toBe("Clean Diagram");
      expect(result.diagram.tables).toHaveLength(1);
    });
  });
});
