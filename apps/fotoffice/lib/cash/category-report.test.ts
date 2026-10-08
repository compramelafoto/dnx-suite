import { describe, expect, it } from "vitest";
import { categoryReportRows, groupCategoryReportRows } from "./category-report";
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

describe("groupCategoryReportRows", () => {
  const fila = (categoryId: string | null, categoryName: string, totalMinor: number, count = 1) => ({
    categoryId,
    categoryName,
    totalMinor,
    count,
  });
  const suma = (xs: { totalMinor: number }[]) => xs.reduce((a, x) => a + x.totalMinor, 0);

  it("sin perfiles no cambia nada: mismo orden, mismos importes, sin hijos", () => {
    const filas = [fila("ventas", "Ventas", 100_00), fila("servicios", "Servicios", 50_00), fila(null, "Sin categoría", 7_00)];
    const grupos = groupCategoryReportRows(filas, new Map());
    expect(grupos.map((g) => [g.categoryId, g.totalMinor, g.children.length])).toEqual([
      ["ventas", 100_00, 0],
      ["servicios", 50_00, 0],
      [null, 7_00, 0],
    ]);
  });

  it("el padre lleva el subtotal suyo y de sus hijos, y el total general no cambia", () => {
    const filas = [
      fila("estudio", "Estudio Fotográfico", 10_00, 1),
      fila("bodas", "Bodas", 300_00, 2),
      fila("quince", "Cumpleaños de 15", 200_00, 1),
      fila("ventas", "Ventas", 40_00, 4),
    ];
    const perfiles = new Map([
      ["estudio", { parentCategoryId: null, code: "3.1" }],
      ["bodas", { parentCategoryId: "estudio", code: "3.1.1" }],
      ["quince", { parentCategoryId: "estudio", code: "3.1.6" }],
    ]);
    const grupos = groupCategoryReportRows(filas, perfiles);
    expect(grupos).toHaveLength(2);
    const [estudio, ventas] = grupos;
    expect(estudio).toMatchObject({ categoryId: "estudio", code: "3.1", totalMinor: 510_00, count: 4, ownMinor: 10_00, ownCount: 1 });
    expect(estudio!.children.map((c) => [c.categoryId, c.code, c.totalMinor])).toEqual([
      ["bodas", "3.1.1", 300_00],
      ["quince", "3.1.6", 200_00],
    ]);
    expect(ventas).toMatchObject({ categoryId: "ventas", totalMinor: 40_00, children: [] });
    expect(suma(grupos)).toBe(suma(filas));
  });

  it("un padre que no está entre las filas (dado de baja) igual agrupa, con su nombre", () => {
    const filas = [fila("bodas", "Bodas", 300_00)];
    const perfiles = new Map([["bodas", { parentCategoryId: "estudio", code: "3.1.1" }]]);
    const grupos = groupCategoryReportRows(filas, perfiles, new Map([["estudio", "Estudio Fotográfico"]]));
    expect(grupos).toHaveLength(1);
    expect(grupos[0]).toMatchObject({ categoryId: "estudio", categoryName: "Estudio Fotográfico", totalMinor: 300_00, ownMinor: 0 });
    expect(suma(grupos)).toBe(300_00);
  });

  it("si del padre no se sabe ni el nombre, el hijo queda suelto sin perder su importe", () => {
    const filas = [fila("bodas", "Bodas", 300_00)];
    const grupos = groupCategoryReportRows(filas, new Map([["bodas", { parentCategoryId: "fantasma", code: null }]]));
    expect(grupos.map((g) => [g.categoryId, g.totalMinor])).toEqual([["bodas", 300_00]]);
  });

  it("ordena por código; los que no tienen van después, en el orden de antes", () => {
    const filas = [fila("ventas", "Ventas", 1), fila("isla", "La Isla", 2), fila("costos", "Costos Directos", 3)];
    const perfiles = new Map([
      ["isla", { parentCategoryId: null, code: "4.0" }],
      ["costos", { parentCategoryId: null, code: "4.1" }],
    ]);
    expect(groupCategoryReportRows(filas, perfiles).map((g) => g.categoryId)).toEqual(["isla", "costos", "ventas"]);
  });
});
