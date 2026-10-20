import { describe, expect, it } from "vitest";
import { aCentavos, cotizar, formatearMontoAr, parsearMontoAr } from "./precios";

const T = [
  { id: "t10", widthCm: 10, heightCm: 15, proveedorId: "fotolag", priceCents: 50000, costCents: 20000 },
  { id: "t30", widthCm: 30, heightCm: 40, proveedorId: "isla", priceCents: 900000, costCents: 400000 },
];
const R = { x: 0, y: 0, w: 1, h: 1 };

describe("cotizar", () => {
  it("suma precio, costo y ganancia por cantidad", () => {
    const c = cotizar([
      { archivoId: "a", sizeId: "t10", quantity: 2, recorte: R },
      { archivoId: "b", sizeId: "t30", quantity: 1, recorte: R },
    ], T);
    if ("error" in c) throw new Error(c.error);
    expect(c.subtotalCents).toBe(2 * 50000 + 900000);
    expect(c.costCents).toBe(2 * 20000 + 400000);
    expect(c.gananciaCents).toBe(c.subtotalCents - c.costCents);
    expect(c.copias).toBe(3);
    expect(c.lineas[1].proveedorId).toBe("isla");
  });
  it("un tamaño que no se ofrece es error", () => {
    expect(cotizar([{ archivoId: "a", sizeId: "nope", quantity: 1, recorte: R }], T)).toEqual({ error: "Uno de los tamaños elegidos ya no está disponible." });
  });
  it("carrito vacío es error", () => {
    expect(cotizar([], T)).toEqual({ error: "Elegí al menos una copia." });
  });
});

describe("aCentavos", () => {
  it("convierte decimales de Prisma y nulos", () => {
    expect(aCentavos({ toString: () => "1234.50" })).toBe(123450);
    expect(aCentavos(null)).toBeNull();
  });
});

describe("parsearMontoAr", () => {
  it.each([
    ["1500.5", 1500.5],
    ["1500.50", 1500.5],
    ["1500,50", 1500.5],
    ["1.500,50", 1500.5],
    ["1.500", 1500],
    ["1.500.000", 1500000],
    ["1500", 1500],
    ["0", 0],
  ])("%s -> %s", (entrada, esperado) => expect(parsearMontoAr(entrada)).toBe(esperado));
  it.each(["abc", "-1", "", "1,2,3"])("%s es inválido", (e) => expect(parsearMontoAr(e)).toBeNull());
  it("ida y vuelta con el formato es-AR", () => {
    for (const n of ["1500.5", "1500", "0.05", "12345.67"]) {
      expect(parsearMontoAr(formatearMontoAr(n))).toBe(Number(n));
    }
    expect(formatearMontoAr("1500.5")).toBe("1500,50");
    expect(formatearMontoAr(null)).toBe("");
  });
});
