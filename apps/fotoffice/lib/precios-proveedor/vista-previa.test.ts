import { describe, expect, it } from "vitest";
import { armarVistaPrevia, type ProductoParaVista } from "./vista-previa";
import { TRAMOS_POR_OMISION } from "./redondeo";

function prod(p: Partial<ProductoParaVista>): ProductoParaVista {
  return { name: "P", costMinor: null, priceMinor: 720_000, marginPct: 170, preferredProveedorId: "isla", variantesConPrecio: false, ...p };
}

describe("armarVistaPrevia", () => {
  it("costo nuevo × margen, redondeado", () => {
    const [f] = armarVistaPrevia([{ productId: "a", costoMinor: 265_000, factor: 1 }], new Map([["a", prod({})]]), "isla", TRAMOS_POR_OMISION);
    expect(f).toMatchObject({ aplica: true, costoNuevoMinor: 265_000, precioNuevoMinor: 750_000, marcas: [] });
  });
  it("sin margen: cambia el costo y el precio queda", () => {
    const [f] = armarVistaPrevia([{ productId: "a", costoMinor: 265_000, factor: 1 }], new Map([["a", prod({ marginPct: null })]]), "isla", TRAMOS_POR_OMISION);
    expect(f).toMatchObject({ aplica: true, precioNuevoMinor: 720_000, marcas: ["SIN_MARGEN"] });
  });
  it("otro proveedor preferido: no se toca nada", () => {
    const [f] = armarVistaPrevia([{ productId: "a", costoMinor: 265_000, factor: 1 }], new Map([["a", prod({ preferredProveedorId: "fotolag", costMinor: 100_000 })]]), "isla", TRAMOS_POR_OMISION);
    expect(f).toMatchObject({ aplica: false, precioNuevoMinor: 720_000, marcas: ["OTRO_PROVEEDOR"] });
  });
  it("aplica el factor y marca subas de más de 30 % y bajas", () => {
    const [sube] = armarVistaPrevia([{ productId: "a", costoMinor: 3_850_000, factor: 0.6 }], new Map([["a", prod({ marginPct: 100, priceMinor: 2_000_000 })]]), "isla", TRAMOS_POR_OMISION);
    expect(sube!.costoNuevoMinor).toBe(2_310_000);
    expect(sube!.precioNuevoMinor).toBe(4_700_000);
    expect(sube!.marcas).toContain("SUBE_MUCHO");
    const [baja] = armarVistaPrevia([{ productId: "a", costoMinor: 100_000, factor: 1 }], new Map([["a", prod({ marginPct: 100 })]]), "isla", TRAMOS_POR_OMISION);
    expect(baja!.marcas).toContain("BAJA");
  });
});
