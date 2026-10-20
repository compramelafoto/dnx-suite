import { describe, expect, it } from "vitest";
import { validarCarrito } from "./carrito";

const OK = new Set(["a", "b"]);
const R = { x: 0, y: 0, w: 1, h: 1 };

describe("validarCarrito", () => {
  it("acepta un carrito correcto", () => {
    const r = validarCarrito({ papel: "BRILLO", lineas: [{ archivoId: "a", sizeId: "t", quantity: 2, recorte: R }] }, OK, ["BRILLO", "MATE"]);
    expect(r).toEqual({ ok: true, papel: "BRILLO", lineas: [{ archivoId: "a", sizeId: "t", quantity: 2, recorte: R }] });
  });
  it("rechaza fotos que no son de la carpeta", () => {
    expect(validarCarrito({ papel: "BRILLO", lineas: [{ archivoId: "zzz", sizeId: "t", quantity: 1, recorte: R }] }, OK, ["BRILLO"]).ok).toBe(false);
  });
  it("rechaza cantidades raras y papeles apagados", () => {
    expect(validarCarrito({ papel: "BRILLO", lineas: [{ archivoId: "a", sizeId: "t", quantity: 0, recorte: R }] }, OK, ["BRILLO"]).ok).toBe(false);
    expect(validarCarrito({ papel: "BRILLO", lineas: [{ archivoId: "a", sizeId: "t", quantity: 1000, recorte: R }] }, OK, ["BRILLO"]).ok).toBe(false);
    expect(validarCarrito({ papel: "MATE", lineas: [{ archivoId: "a", sizeId: "t", quantity: 1, recorte: R }] }, OK, ["BRILLO"]).ok).toBe(false);
  });
  it("rechaza más de 500 líneas", () => {
    const lineas = Array.from({ length: 501 }, () => ({ archivoId: "a", sizeId: "t", quantity: 1, recorte: R }));
    expect(validarCarrito({ papel: "BRILLO", lineas }, OK, ["BRILLO"]).ok).toBe(false);
  });
});
