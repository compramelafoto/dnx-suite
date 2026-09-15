import { describe, expect, it } from "vitest";
import { hashTrackingToken, trackingTokenMatches } from "./tracking-token";

/**
 * `trackingTokenMatches` tiene dos defensas para dos problemas distintos: el `try/catch`
 * cubre que `storedHash` no sea un string en runtime (una columna nullable, por ejemplo), y la
 * comparación de longitudes cubre un hash corrupto o truncado —`Buffer.from(str, "hex")` no
 * lanza con una entrada string, corta el parseo y devuelve un buffer más corto—. Este caso
 * ejercita justamente esa segunda defensa.
 */
describe("trackingTokenMatches", () => {
  it("un storedHash que no es hexadecimal válido no lanza, y no matchea", () => {
    const raw = "un-token-cualquiera";
    expect(() => trackingTokenMatches(raw, "esto-no-es-hex-válido")).not.toThrow();
    expect(trackingTokenMatches(raw, "esto-no-es-hex-válido")).toBe(false);
  });

  it("el hash correcto matchea", () => {
    const raw = "un-token-cualquiera";
    expect(trackingTokenMatches(raw, hashTrackingToken(raw))).toBe(true);
  });
});
