import { describe, expect, it } from "vitest";
import { ensureSchemaVersion, stripSchemaVersionField } from "./schema-version";

describe("financial profile persistence envelope", () => {
  it("añade schemaVersion al serializar perfil para DB", () => {
    const versioned = ensureSchemaVersion({
      currency: "ARS",
      weeklyHours: "35",
      livesOnlyFromPhotography: "yes",
    });

    expect(versioned.schemaVersion).toBe(1);

    const stripped = stripSchemaVersionField(versioned);
    expect(stripped).toEqual({
      currency: "ARS",
      weeklyHours: "35",
      livesOnlyFromPhotography: "yes",
    });
  });
});
