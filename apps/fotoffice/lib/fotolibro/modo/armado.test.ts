import { describe, expect, it } from "vitest";
import { armarLibro, momentos, ordenarFotos, planificar } from "./armado";
import { leerEstadoFotolibro, type FotoDelLibro } from "./estado";

const f = (id: string, tomada?: string): FotoDelLibro => ({ id, url: `u/${id}`, vista: "", mini: "", w: 3, h: 2, nombre: id, ...(tomada ? { tomada } : {}) });
// Una boda: ceremonia (fotos cada 1 min desde las 18:00), fiesta (desde las 21:00).
const hora = (h: number, m: number) => `2026-10-12T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
const ceremonia = Array.from({ length: 10 }, (_, i) => f(`c${i}`, hora(18, i)));
const fiesta = Array.from({ length: 14 }, (_, i) => f(`f${i}`, hora(21, i)));

describe("armado automático", () => {
  it("ordena por hora de toma, con las que no tienen hora al final", () => {
    const desordenadas = [f("z"), fiesta[0]!, ceremonia[3]!, f("a"), ceremonia[0]!];
    expect(ordenarFotos(desordenadas, "fecha").map((x) => x.id)).toEqual(["c0", "c3", "f0", "a", "z"]);
  });

  it("encuentra los momentos por los saltos de hora", () => {
    const m = momentos([...ceremonia, ...fiesta]);
    expect(m.map((g) => g.length)).toEqual([10, 14]);
  });

  it("ningún pliego mezcla momentos y se reparten parejo", () => {
    const plan = planificar([...ceremonia, ...fiesta], 6, true);
    expect(plan).toHaveLength(6);
    for (const p of plan) expect(p.every((id) => id.startsWith("c")) || p.every((id) => id.startsWith("f"))).toBe(true);
    expect(plan.flat()).toHaveLength(24);
    const tamanos = plan.map((p) => p.length);
    expect(Math.max(...tamanos) - Math.min(...tamanos)).toBeLessThanOrEqual(2);
  });

  it("con más momentos que pliegos, junta los más chicos", () => {
    const sueltas = [f("a", hora(10, 0)), f("b", hora(12, 0)), f("c", hora(14, 0)), f("d", hora(16, 0))];
    const plan = planificar(sueltas, 2, true);
    expect(plan.flat()).toEqual(["a", "b", "c", "d"]);
    expect(plan.every((p) => p.length > 0)).toBe(true);
  });

  it("rearma el libro entero por pliego entero y con distribuciones variadas", () => {
    const e = leerEstadoFotolibro({ fotolibro: { fotos: [...ceremonia, ...fiesta] } }, 2);
    const x = armarLibro(e, { fotos: e.fotos, orden: "fecha", pliegos: 6, alcance: "todo", porMomentos: true });
    expect(x.pliegos).toHaveLength(6);
    expect(x.pliegos.every((p) => p.modo === "pliego")).toBe(true);
    expect(new Set(x.pliegos.slice(0, 3).map((p) => p.todo.variante)).size).toBe(3);
  });

  it("llenar sólo los vacíos no toca lo ya armado", () => {
    const e = leerEstadoFotolibro({ fotolibro: { fotos: [...ceremonia, ...fiesta], pliegos: [{ todo: { fotos: ["c0"] } }, {}, {}] } }, 3);
    const x = armarLibro(e, { fotos: e.fotos.slice(1), orden: "fecha", pliegos: 3, alcance: "vacios", porMomentos: true });
    expect(x.pliegos[0]!.todo.fotos).toEqual(["c0"]);
    expect(x.pliegos[1]!.todo.fotos.length + x.pliegos[2]!.todo.fotos.length).toBe(23);
  });
});
