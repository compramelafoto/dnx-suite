import { describe, expect, it } from "vitest";
import { userHasWorkLocation } from "./work-location";

describe("userHasWorkLocation", () => {
  it("devuelve false sin coordenadas", () => {
    expect(userHasWorkLocation(null, null)).toBe(false);
    expect(userHasWorkLocation(undefined, -58.4)).toBe(false);
  });

  it("devuelve false con coordenadas inválidas o en cero", () => {
    expect(userHasWorkLocation(NaN, -58.4)).toBe(false);
    expect(userHasWorkLocation(0, 0)).toBe(false);
  });

  it("devuelve true con coordenadas válidas", () => {
    expect(userHasWorkLocation(-34.6, -58.4)).toBe(true);
    expect(userHasWorkLocation(0, -58.4)).toBe(true);
  });
});
