import { describe, expect, it } from "vitest";
import {
  ensureSchemaVersion,
  getCurrentSchemaVersion,
  migrateStoredPayloadToCurrentVersion,
  parseVersionedTemplatesStore,
  resolveStoredSchemaVersion,
  serializeVersionedTemplatesStore,
  stripSchemaVersionField,
} from "./schema-version";

describe("schema-version", () => {
  it("getCurrentSchemaVersion devuelve 1", () => {
    expect(getCurrentSchemaVersion()).toBe(1);
  });

  it("resolveStoredSchemaVersion asume 1 sin campo", () => {
    expect(resolveStoredSchemaVersion({ currency: "ARS" })).toBe(1);
    expect(resolveStoredSchemaVersion([{ id: "a" }])).toBe(1);
    expect(resolveStoredSchemaVersion(null)).toBe(1);
  });

  it("resolveStoredSchemaVersion respeta valor persistido", () => {
    expect(resolveStoredSchemaVersion({ schemaVersion: 1, foo: "bar" })).toBe(1);
  });

  it("ensureSchemaVersion añade schemaVersion sin quitar datos", () => {
    const payload = { currency: "ARS", weeklyHours: "40" };
    expect(ensureSchemaVersion(payload)).toEqual({
      currency: "ARS",
      weeklyHours: "40",
      schemaVersion: 1,
    });
  });

  it("stripSchemaVersionField no altera el dominio", () => {
    const raw = { currency: "ARS", schemaVersion: 1 };
    expect(stripSchemaVersionField(raw)).toEqual({ currency: "ARS" });
  });

  it("migrateStoredPayloadToCurrentVersion no modifica legacy v1", () => {
    const legacy = { client: { name: "Ana" }, concepts: [] };
    expect(migrateStoredPayloadToCurrentVersion(legacy)).toEqual(legacy);
  });

  it("parseVersionedTemplatesStore lee array legacy", () => {
    const legacy = [{ id: "pst-1", name: "Sesión" }];
    expect(parseVersionedTemplatesStore(legacy)).toEqual(legacy);
  });

  it("parseVersionedTemplatesStore lee envelope versionado", () => {
    const store = { schemaVersion: 1, templates: [{ id: "pst-2" }] };
    expect(parseVersionedTemplatesStore(store)).toEqual([{ id: "pst-2" }]);
  });

  it("serializeVersionedTemplatesStore produce envelope v1", () => {
    const json = serializeVersionedTemplatesStore([{ id: "pst-3" }]);
    expect(JSON.parse(json)).toEqual({
      schemaVersion: 1,
      templates: [{ id: "pst-3" }],
    });
  });
});
