import { describe, expect, it } from "vitest";
import { direccionDeDeslizar, ubicarCaja } from "./album-gestos";
import { limpiarAsunto } from "./asunto";

describe("direccionDeDeslizar", () => {
  it("un deslizar horizontal claro cambia de lámina", () => {
    expect(direccionDeDeslizar(-120, 10, false, false)).toBe(1);
    expect(direccionDeDeslizar(120, -10, false, false)).toBe(-1);
  });
  it("corto, diagonal o no finito no cambia", () => {
    expect(direccionDeDeslizar(30, 0, false, false)).toBe(0);
    expect(direccionDeDeslizar(100, 90, false, false)).toBe(0);
    expect(direccionDeDeslizar(NaN, 0, false, false)).toBe(0);
  });
  it("con la cajita abierta o si empezó dentro de ella, nunca", () => {
    expect(direccionDeDeslizar(-300, 0, true, false)).toBe(0);
    expect(direccionDeDeslizar(-300, 0, false, true)).toBe(0);
  });
});

describe("ubicarCaja", () => {
  it("en pantallas angostas usa la hoja inferior (null)", () => {
    expect(ubicarCaja(375, 400, { left: 100, top: 50 })).toBeNull();
  });
  it("queda dentro del visor y debajo o encima del punto", () => {
    const a = ubicarCaja(800, 500, { left: 790, top: 50 })!;
    expect(a.left + a.width).toBeLessThanOrEqual(796);
    expect(a.top).toBe(68);
    const b = ubicarCaja(800, 500, { left: 5, top: 400 })!;
    expect(b.left).toBe(4);
    expect(b.bottom).toBe(118);
  });
});

describe("limpiarAsunto", () => {
  it("saca saltos de línea y controles y colapsa espacios", () => {
    expect(limpiarAsunto("Ana\r\nBcc: x@y.com\tGómez\u0000 ")).toBe("Ana Bcc: x@y.com Gómez");
    expect(limpiarAsunto("Boda  García")).toBe("Boda García");
  });
});
