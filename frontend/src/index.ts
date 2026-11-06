// Frontend index exports
export type { Diagram, Table, Column, Relationship, UniqueConstraint, Index, ColumnType } from "./types/diagram";
export type { DiagramJSON } from "./types/diagram";
export type { DbCredentials } from "./types/credentials";
export {
  serializeDiagram,
  deserializeDiagram,
  hasCredentials,
  DIAGRAM_JSON_VERSION,
  stripCredentials,
  CREDENTIAL_FIELDS,
} from "./services/diagram-serializer";
export {
  setCredentials,
  getCredentials,
  clearCredentials,
  hasCredentials as hasStoredCredentials,
} from "./services/credential-store";
export { generateId, clamp } from "./utils/id";
