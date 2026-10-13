import { describe, expect, it } from "vitest";
import { incidentSignature } from "./signature";

describe("incidentSignature", () => {
  it("no depende del orden de las claves y es estable", () => {
    expect(incidentSignature({ a: "1", b: 2 })).toBe(incidentSignature({ b: 2, a: "1" }));
    expect(incidentSignature({ a: "1" })).toMatch(/^[0-9a-f]{16}$/);
  });
  it("ignora claves undefined", () => {
    expect(incidentSignature({ a: "1", b: undefined })).toBe(incidentSignature({ a: "1" }));
  });
});
