import { describe, expect, it } from "vitest";
import { leerCamposDeVenta } from "./course-sale-fields";

function form(campos: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.set(k, v);
  return f;
}

describe("los campos de venta del curso", () => {
  it("lee precio, meses, porcentaje y gratis para socios", () => {
    expect(
      leerCamposDeVenta(form({ priceArs: "45000", accessMonths: "6", completionPercent: "90", freeForMembers: "on" })),
    ).toEqual({ priceArs: 45000, accessMonths: 6, completionPercent: 90, freeForMembers: true });
  });

  it("sin los campos, usa los valores por defecto y no inventa un precio", () => {
    expect(leerCamposDeVenta(form({}))).toEqual({
      priceArs: null,
      accessMonths: 12,
      completionPercent: 80,
      freeForMembers: false,
    });
  });

  it("un precio con coma decimal se entiende", () => {
    expect(leerCamposDeVenta(form({ priceArs: "45000,50" })).priceArs).toBe(45000.5);
  });

  it("entiende el formato argentino y rechaza lo ambiguo", () => {
    const precio = (v: string) => leerCamposDeVenta(form({ priceArs: v })).priceArs;
    expect(precio("45.000")).toBe(45000);
    expect(precio("45.000,50")).toBe(45000.5);
    expect(precio("45000.5")).toBe(45000.5);
    expect(precio("1.234.567")).toBe(1234567);
    for (const malo of ["abc", "Infinity", "-5", "45.00.0", "1e5"]) expect(precio(malo)).toBeNaN();
  });
});
