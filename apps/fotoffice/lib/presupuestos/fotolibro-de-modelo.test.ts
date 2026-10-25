import { describe, expect, it } from "vitest";
import type { CatalogoFotolibro } from "@/lib/fotolibro/cotizar";
import { cotizarFotolibroDeModelo, validarFotolibroDeModelo } from "./fotolibro-de-modelo";

// Román 30x60 Gold: tapa 27.000 y hoja 9.500 de costo, ×3 (base = costo × 3, en centavos).
const CATALOGO: CatalogoFotolibro = {
  ofertas: [
    {
      proveedorId: "prov-roman",
      proveedor: "Román",
      vigencia: "2026-10",
      tapas: [{ medida: "30x60", modelo: "Gold", baseMinor: 27_000_00 * 3, costoMinor: null }],
      hojas: [{ medida: "30x60", modelo: null, baseMinor: 9_500_00 * 3, costoMinor: null }],
      cajas: [{ medida: "30x60", modelo: "Gold", baseMinor: 20_000_00 * 3, costoMinor: null }],
    },
  ],
  tramos: [],
  fotosPorHoja: {},
  marginPct: 200,
};

const GOLD = { proveedorId: "prov-roman", modelo: "Gold", medida: "30x60", hojas: 10, conCaja: false };

describe("validarFotolibroDeModelo", () => {
  it("acepta lo que eligió la calculadora y descarta lo demás", () => {
    expect(validarFotolibroDeModelo({ ...GOLD, perfil: 1, precio: 9 })).toEqual(GOLD);
    expect(validarFotolibroDeModelo({ ...GOLD, modelo: "  Gold " })).toEqual(GOLD);
  });

  it("rechaza datos incompletos o fuera de rango", () => {
    expect(validarFotolibroDeModelo(null)).toBeNull();
    expect(validarFotolibroDeModelo({ ...GOLD, proveedorId: "a b" })).toBeNull();
    expect(validarFotolibroDeModelo({ ...GOLD, modelo: "" })).toBeNull();
    expect(validarFotolibroDeModelo({ ...GOLD, medida: "x".repeat(21) })).toBeNull();
    expect(validarFotolibroDeModelo({ ...GOLD, hojas: 0 })).toBeNull();
    expect(validarFotolibroDeModelo({ ...GOLD, hojas: 2.5 })).toBeNull();
    expect(validarFotolibroDeModelo({ ...GOLD, hojas: 101 })).toBeNull();
    expect(validarFotolibroDeModelo({ ...GOLD, conCaja: "si" })).toBeNull();
  });
});

describe("cotizarFotolibroDeModelo", () => {
  it("cotiza con la lista de hoy: 30x60 Gold 10 hojas = 366.000 y 20 hojas = 651.000", () => {
    const sesion = cotizarFotolibroDeModelo(CATALOGO, GOLD);
    expect(sesion).toMatchObject({ ok: true, libro: { precio: 366_000 }, caja: null });
    const fiesta = cotizarFotolibroDeModelo(CATALOGO, { ...GOLD, hojas: 20 });
    expect(fiesta).toMatchObject({ ok: true, libro: { precio: 651_000 } });
  });

  it("si la lista cambia, el precio también", () => {
    const subio: CatalogoFotolibro = {
      ...CATALOGO,
      ofertas: [{ ...CATALOGO.ofertas[0]!, hojas: [{ medida: "30x60", modelo: null, baseMinor: 10_000_00 * 3, costoMinor: null }] }],
    };
    expect(cotizarFotolibroDeModelo(subio, GOLD)).toMatchObject({ ok: true, libro: { precio: 381_000 } });
  });

  it("con caja, la caja va aparte", () => {
    const r = cotizarFotolibroDeModelo(CATALOGO, { ...GOLD, conCaja: true });
    expect(r).toMatchObject({ ok: true, libro: { precio: 366_000 }, caja: { precio: 60_000 } });
  });

  it("sin lista o sin ese modelo, no inventa un precio", () => {
    expect(cotizarFotolibroDeModelo(null, GOLD)).toEqual({ ok: false });
    expect(cotizarFotolibroDeModelo(CATALOGO, { ...GOLD, proveedorId: "otro" })).toEqual({ ok: false });
    expect(cotizarFotolibroDeModelo(CATALOGO, { ...GOLD, modelo: "Tiffany" })).toEqual({ ok: false });
  });
});
