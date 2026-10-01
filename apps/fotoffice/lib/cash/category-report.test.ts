import { describe, expect, it } from "vitest";
import { categoryReportRows } from "./category-report";
import type { CategoryTotal } from "./balance";

const categorias = [
  { id: "ventas", name: "Ventas" },
  { id: "sueldos", name: "Sueldos" },
];

describe("categoryReportRows", () => {
  it("una categoría activa sin movimientos entra en cero, no desaparece", () => {
    const totales: CategoryTotal[] = [
      { categoryId: "ventas", categoryName: "Ventas", kind: "INGRESO", totalMinor: 1_000_00, count: 3 },
    ];
    const filas = categoryReportRows(categorias, totales, "EGRESO");
    expect(filas).toEqual([
      { categoryId: "ventas", categoryName: "Ventas", totalMinor: 0, count: 0 },
      { categoryId: "sueldos", categoryName: "Sueldos", totalMinor: 0, count: 0 },
    ]);
  });

  it("respeta el orden en que se configuraron las categorías, no el importe", () => {
    const totales: CategoryTotal[] = [
      { categoryId: "sueldos", categoryName: "Sueldos", kind: "EGRESO", totalMinor: 500_00, count: 1 },
      { categoryId: "ventas", categoryName: "Ventas", kind: "EGRESO", totalMinor: 10_00, count: 1 },
    ];
    const filas = categoryReportRows(categorias, totales, "EGRESO");
    expect(filas.map((f) => f.categoryId)).toEqual(["ventas", "sueldos"]);
  });

  it("un movimiento sin categoría se agrega al final", () => {
    const totales: CategoryTotal[] = [
      { categoryId: null, categoryName: "Sin categoría", kind: "INGRESO", totalMinor: 300_00, count: 2 },
    ];
    const filas = categoryReportRows(categorias, totales, "INGRESO");
    expect(filas).toEqual([
      { categoryId: "ventas", categoryName: "Ventas", totalMinor: 0, count: 0 },
      { categoryId: "sueldos", categoryName: "Sueldos", totalMinor: 0, count: 0 },
      { categoryId: null, categoryName: "Sin categoría", totalMinor: 300_00, count: 2 },
    ]);
  });

  it("una categoría dada de baja con movimientos en el período no se pierde", () => {
    // "alquiler" no está en `categorias`: se desactivó, pero tuvo gastos este mes.
    const totales: CategoryTotal[] = [
      { categoryId: "alquiler", categoryName: "Alquiler del local", kind: "EGRESO", totalMinor: 200_00, count: 1 },
    ];
    const filas = categoryReportRows(categorias, totales, "EGRESO");
    expect(filas).toContainEqual({
      categoryId: "alquiler",
      categoryName: "Alquiler del local",
      totalMinor: 200_00,
      count: 1,
    });
  });

  it("separa por lado: un ingreso de Ventas no contamina el reporte de egresos", () => {
    const totales: CategoryTotal[] = [
      { categoryId: "ventas", categoryName: "Ventas", kind: "INGRESO", totalMinor: 1_000_00, count: 5 },
    ];
    const filas = categoryReportRows(categorias, totales, "EGRESO");
    const ventas = filas.find((f) => f.categoryId === "ventas");
    expect(ventas).toEqual({ categoryId: "ventas", categoryName: "Ventas", totalMinor: 0, count: 0 });
  });

  it("sin categorías configuradas y sin movimientos, no hay filas", () => {
    expect(categoryReportRows([], [], "INGRESO")).toEqual([]);
  });
});
