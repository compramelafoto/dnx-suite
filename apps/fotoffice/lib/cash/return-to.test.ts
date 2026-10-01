import { describe, expect, it } from "vitest";
import { sanitizeReturnTo } from "./return-to";

describe("sanitizeReturnTo", () => {
  it("una ruta interna común pasa tal cual", () => {
    expect(sanitizeReturnTo("/caja/turnos", "/caja/pases")).toBe("/caja/turnos");
  });

  it("nada (ni el campo ni el valor) cae al destino fijo", () => {
    expect(sanitizeReturnTo(null, "/caja/pases")).toBe("/caja/pases");
    expect(sanitizeReturnTo(undefined, "/caja/pases")).toBe("/caja/pases");
    expect(sanitizeReturnTo("", "/caja/pases")).toBe("/caja/pases");
    expect(sanitizeReturnTo("   ", "/caja/pases")).toBe("/caja/pases");
  });

  it("una URL con esquema se rechaza, aunque parezca del mismo sitio", () => {
    expect(sanitizeReturnTo("https://evil.com/caja/turnos", "/caja/pases")).toBe("/caja/pases");
    expect(sanitizeReturnTo("javascript:alert(1)", "/caja/pases")).toBe("/caja/pases");
  });

  it("una URL scheme-relative (//otro-host) se rechaza", () => {
    expect(sanitizeReturnTo("//evil.com/caja/turnos", "/caja/pases")).toBe("/caja/pases");
  });

  it("una ruta sin la barra inicial se rechaza", () => {
    expect(sanitizeReturnTo("caja/turnos", "/caja/pases")).toBe("/caja/pases");
  });

  it("recorta espacios antes de decidir", () => {
    expect(sanitizeReturnTo("  /caja/turnos  ", "/caja/pases")).toBe("/caja/turnos");
  });
});
