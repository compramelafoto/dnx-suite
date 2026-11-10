import { describe, expect, it } from "vitest";
import { estadoValido, nuevoEstado, valorDeCookie } from "./estado-oauth";

describe("state del ida y vuelta con CLF", () => {
  it("coincide sólo con el mismo state y el mismo workspace", () => {
    const s = nuevoEstado();
    const c = valorDeCookie(s, "ws-1");
    expect(estadoValido(c, s, "ws-1")).toBe(true);
    expect(estadoValido(c, s, "ws-2")).toBe(false);
    expect(estadoValido(c, nuevoEstado(), "ws-1")).toBe(false);
    expect(estadoValido(undefined, s, "ws-1")).toBe(false);
    expect(estadoValido(c, null, "ws-1")).toBe(false);
    expect(estadoValido("sinpunto", s, "ws-1")).toBe(false);
  });
  it("cada state es distinto y largo", () => {
    expect(nuevoEstado()).not.toBe(nuevoEstado());
    expect(nuevoEstado().length).toBeGreaterThanOrEqual(43);
  });
});
