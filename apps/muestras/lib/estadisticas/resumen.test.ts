import { describe, expect, it } from "vitest";
import { filasDeTotales, resumenPorMuestra } from "./resumen";

describe("resumen de estadísticas", () => {
  it("por muestra: visitas, escaneos y comentarios", () => {
    const r = resumenPorMuestra(
      [
        { activityId: "a", metric: "VIEW", _sum: { count: 12 } },
        { activityId: "a", metric: "SCAN", _sum: { count: 3 } },
        { activityId: "a", metric: "GUESTBOOK_SCAN", _sum: { count: 2 } },
        { activityId: "b", metric: "VIEW", _sum: { count: null } },
      ],
      [
        { activityId: "a", status: "PUBLISHED", _count: { _all: 4 } },
        { activityId: "a", status: "PENDING", _count: { _all: 1 } },
      ],
    );
    expect(r.get("a")).toEqual({ visitas: 12, escaneos: 5, comentarios: 4, pendientes: 1 });
    expect(r.get("b")).toEqual({ visitas: 0, escaneos: 0, comentarios: 0, pendientes: 0 });
    expect(r.get("c")).toBeUndefined();
  });
  it("de groupBy a filas sin día", () => {
    expect(filasDeTotales([{ workId: "w1", metric: "SCAN", _sum: { count: 4 } }])).toEqual([{ workId: "w1", day: "", metric: "SCAN", count: 4 }]);
  });
});
