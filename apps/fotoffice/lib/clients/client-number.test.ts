import { describe, expect, it } from "vitest";
import { nextClientNumber } from "./client-number";

describe("nextClientNumber", () => {
  it("el primer cliente del workspace es el 1", () => {
    expect(nextClientNumber(null)).toBe(1);
  });

  it("sigue al último", () => {
    expect(nextClientNumber(47)).toBe(48);
  });

  it("un hueco en el medio no se rellena: sigue al mayor", () => {
    expect(nextClientNumber(120)).toBe(121);
  });
});
