import { describe, expect, it } from "vitest";
import { calcularNuevoOrden } from "@/lib/presential-courses/lesson-order";

describe("reordenar clases", () => {
  it("mover la tercera al primer lugar renumera sin huecos ni repetidos", () => {
    expect(calcularNuevoOrden(["a", "b", "c", "d"], "c", 0)).toEqual([
      { id: "c", sortOrder: 0 },
      { id: "a", sortOrder: 1 },
      { id: "b", sortOrder: 2 },
      { id: "d", sortOrder: 3 },
    ]);
  });

  it("mover al final deja el resto corrido hacia arriba", () => {
    expect(calcularNuevoOrden(["a", "b", "c"], "a", 2)).toEqual([
      { id: "b", sortOrder: 0 },
      { id: "c", sortOrder: 1 },
      { id: "a", sortOrder: 2 },
    ]);
  });

  it("un destino más allá del final no rompe: va última", () => {
    expect(calcularNuevoOrden(["a", "b"], "a", 99)).toEqual([
      { id: "b", sortOrder: 0 },
      { id: "a", sortOrder: 1 },
    ]);
  });

  it("un destino negativo no rompe: va primera", () => {
    expect(calcularNuevoOrden(["a", "b"], "b", -5)).toEqual([
      { id: "b", sortOrder: 0 },
      { id: "a", sortOrder: 1 },
    ]);
  });

  it("una clase que no está en la lista no cambia nada, pero renumera", () => {
    expect(calcularNuevoOrden(["a", "b"], "z", 0)).toEqual([
      { id: "a", sortOrder: 0 },
      { id: "b", sortOrder: 1 },
    ]);
  });

  it("la numeración final siempre es 0..n-1, sin repetidos", () => {
    const r = calcularNuevoOrden(["a", "b", "c", "d", "e"], "d", 1);
    expect(r.map((x) => x.sortOrder)).toEqual([0, 1, 2, 3, 4]);
    expect(new Set(r.map((x) => x.id)).size).toBe(5);
  });
});
