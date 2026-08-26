import { describe, it, expect } from "vitest";
import {
  DEFAULT_COLLECTION_MODE,
  readCollectionMode,
  requiresSplitConsent,
  COLLECTION_MODE_ENV,
} from "./mode";

describe("readCollectionMode", () => {
  it("sin variable configurada, cobra en dos vías", () => {
    expect(readCollectionMode({})).toBe("TWO_WAY");
    expect(DEFAULT_COLLECTION_MODE).toBe("TWO_WAY");
  });

  it("acepta 1:N cuando se lo pide explícitamente", () => {
    expect(readCollectionMode({ [COLLECTION_MODE_ENV]: "SPLIT_1N" })).toBe("SPLIT_1N");
    expect(readCollectionMode({ [COLLECTION_MODE_ENV]: " split_1n " })).toBe("SPLIT_1N");
  });

  it("un valor que no se entiende cae en dos vías, no en 1:N", () => {
    // Caer en 1:N dejaría a la institución sin poder cobrar, esperando un consentimiento
    // que en dos vías ni siquiera existe.
    expect(readCollectionMode({ [COLLECTION_MODE_ENV]: "cualquier cosa" })).toBe("TWO_WAY");
    expect(readCollectionMode({ [COLLECTION_MODE_ENV]: "" })).toBe("TWO_WAY");
  });
});

describe("requiresSplitConsent", () => {
  it("dos vías no necesita consentimiento", () => {
    expect(requiresSplitConsent("TWO_WAY")).toBe(false);
  });

  it("1:N sí lo necesita", () => {
    expect(requiresSplitConsent("SPLIT_1N")).toBe(true);
  });
});
