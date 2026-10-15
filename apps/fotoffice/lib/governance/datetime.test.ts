import { describe, expect, it } from "vitest";
import { toLocalDateTimeInput } from "./datetime";

describe("fecha y hora para el formulario", () => {
  it("vuelve en hora argentina", () => {
    expect(toLocalDateTimeInput(new Date("2026-10-15T22:30:00Z"))).toBe("2026-10-15T19:30");
    expect(toLocalDateTimeInput(new Date("2026-10-16T03:00:00Z"))).toBe("2026-10-16T00:00");
    expect(toLocalDateTimeInput(null)).toBe("");
  });
});
