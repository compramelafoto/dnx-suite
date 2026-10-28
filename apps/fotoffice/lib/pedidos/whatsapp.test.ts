import { describe, expect, it } from "vitest";
import { claveDelAlta, elegirProducto, planDelBot, senaDe } from "./whatsapp";

const CATALOGO = [
  { id: "vhs", name: "Digitalización de VHS", priceMinor: 1_200_000, variants: [] },
  { id: "p64", name: "Pendrive 64 GB", priceMinor: 2_600_000, variants: [] },
  { id: "p128", name: "Pendrive 128 GB", priceMinor: 4_500_000, variants: [] },
  { id: "cuadro", name: "Cuadro canvas", priceMinor: 0, variants: [{ id: "c30", name: "30x40", priceMinor: 3_000_000 }, { id: "c50", name: "50x70", priceMinor: 6_000_000 }] },
  { id: "gratis", name: "Retoque sin cargo", priceMinor: 0, variants: [] },
];

describe("elegirProducto", () => {
  it("encuentra por nombre exacto, sin importar tildes ni mayúsculas", () => {
    expect(elegirProducto(CATALOGO, "digitalizacion de vhs")).toEqual({ ok: true, productId: "vhs", variantId: null, nombre: "Digitalización de VHS", precio: 12000 });
  });
  it("acepta un pedazo del nombre si coincide con uno solo", () => {
    expect(elegirProducto(CATALOGO, "pendrive 64")).toMatchObject({ ok: true, productId: "p64", precio: 26000 });
  });
  it("si coincide con varios, devuelve las opciones", () => {
    expect(elegirProducto(CATALOGO, "pendrive")).toEqual({ ok: false, motivo: "AMBIGUO", opciones: ["Pendrive 64 GB", "Pendrive 128 GB"] });
  });
  it("no inventa productos ni vende sin precio", () => {
    expect(elegirProducto(CATALOGO, "dron")).toMatchObject({ ok: false, motivo: "NO_ESTA" });
    expect(elegirProducto(CATALOGO, "retoque sin cargo")).toMatchObject({ ok: false, motivo: "SIN_PRECIO" });
  });
  it("con talles, exige el talle", () => {
    expect(elegirProducto(CATALOGO, "cuadro canvas")).toMatchObject({ ok: false, motivo: "VARIANTE", opciones: ["Cuadro canvas 30x40", "Cuadro canvas 50x70"] });
    expect(elegirProducto(CATALOGO, "cuadro canvas", "50x70")).toEqual({ ok: true, productId: "cuadro", variantId: "c50", nombre: "Cuadro canvas 50x70", precio: 60000 });
  });
});

describe("seña y plan", () => {
  it("la seña es el 50 % en pesos enteros", () => {
    expect(senaDe(60000)).toEqual({ sena: 30000, saldo: 30000 });
    expect(senaDe(25001)).toEqual({ sena: 12501, saldo: 12500 });
  });
  it("con seña: dos cuotas, el saldo a la semana", () => {
    expect(planDelBot(86000, "SENA", "2026-10-28")).toEqual([
      { dueDate: "2026-10-28", amountArs: 43000 },
      { dueDate: "2026-11-04", amountArs: 43000 },
    ]);
  });
  it("al contado: una cuota hoy", () => {
    expect(planDelBot(86000, "TOTAL", "2026-10-28")).toEqual([{ dueDate: "2026-10-28", amountArs: 86000 }]);
  });
});

describe("claveDelAlta", () => {
  it("lo mismo da la misma clave; otra cosa, otra", () => {
    const a = claveDelAlta("cmvgd81nh0001l207zq54kl3i", [{ productId: "vhs", variantId: null, cantidad: 5 }], "SENA");
    expect(a).toMatch(/^wa-cmvgd81nh0001l207zq54kl3i-[0-9a-f]{12}$/);
    expect(claveDelAlta("cmvgd81nh0001l207zq54kl3i", [{ productId: "vhs", variantId: null, cantidad: 5 }], "SENA")).toBe(a);
    expect(claveDelAlta("cmvgd81nh0001l207zq54kl3i", [{ productId: "vhs", variantId: null, cantidad: 4 }], "SENA")).not.toBe(a);
  });
});
