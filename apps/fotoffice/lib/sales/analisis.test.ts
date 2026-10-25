import { describe, expect, it } from "vitest";
import { analizar, enArgentina, escalon, type VentaAnalisis } from "./analisis";

const venta = (iso: string, totalMinor: number, renglones: VentaAnalisis["renglones"] = [], vendedorId: number | null = 995): VentaAnalisis => ({
  fecha: new Date(iso),
  totalMinor,
  vendedorId,
  renglones,
});

describe("análisis de ventas", () => {
  it("la hora y el día son de Argentina", () => {
    // Sábado 24/10/2026 01:30 UTC = viernes 23/10 22:30 en Argentina.
    expect(enArgentina(new Date("2026-10-24T01:30:00Z"))).toEqual({ dia: 4, hora: 22, fecha: "2026-10-23" });
  });

  it("suma por hora, día, fecha, producto, categoría y vendedor", () => {
    const a = analizar([
      venta("2026-10-19T13:10:00Z", 1000_00, [{ productId: "p1", nombre: "Carnet", categoria: "Fotos carnet", unidades: 1, importeMinor: 1000_00 }]),
      venta("2026-10-19T13:40:00Z", 500_00, [{ productId: "p2", nombre: "Copia", categoria: "Copias", unidades: 5, importeMinor: 500_00 }], 997),
      venta("2026-10-20T18:00:00Z", 2000_00, [{ productId: "p1", nombre: "Carnet", categoria: "Fotos carnet", unidades: 2, importeMinor: 2000_00 }]),
    ]);
    expect(a.ventas).toBe(3);
    expect(a.totalMinor).toBe(3500_00);
    expect(a.ticketPromedioMinor).toBe(Math.round(3500_00 / 3));
    // Lunes 19/10 a las 10 de Argentina: dos ventas.
    expect(a.mapa[0]![10]).toEqual({ cantidad: 2, importeMinor: 1500_00 });
    expect(a.porDia[1]).toEqual({ cantidad: 1, importeMinor: 2000_00 });
    expect(a.mejoresFechas[0]).toEqual({ fecha: "2026-10-20", cantidad: 1, importeMinor: 2000_00 });
    expect(a.productos[0]).toMatchObject({ clave: "p1", unidades: 3, importeMinor: 3000_00, ventas: 2 });
    expect(a.categorias.map((c) => c.nombre)).toEqual(["Fotos carnet", "Copias"]);
    expect(a.vendedores[0]).toEqual({ vendedorId: 995, ventas: 2, importeMinor: 3000_00 });
  });

  it("sin ventas, todo en cero", () => {
    const a = analizar([]);
    expect(a.ticketPromedioMinor).toBe(0);
    expect(a.productos).toEqual([]);
  });

  it("escalones del mapa de calor", () => {
    expect(escalon(0, 10)).toBe(0);
    expect(escalon(1, 10)).toBe(1);
    expect(escalon(10, 10)).toBe(5);
    expect(escalon(5, 0)).toBe(0);
  });
});
