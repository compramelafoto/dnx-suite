import { describe, expect, it } from "vitest";
import { presupuestoDeIds, TOPE_IDS_POR_CONSULTA } from "./presupuesto";

const rango = (pre: string, n: number, desde = 0) => Array.from({ length: n }, (_, i) => `${pre}${i + desde}`);

describe("presupuestoDeIds", () => {
  it("sin listas no restringe nada", () => {
    expect(presupuestoDeIds({ y: [], o: [] })).toEqual({ excedido: false, y: null, o: [] });
    expect(presupuestoDeIds({ y: [null, null], o: [[]] })).toEqual({ excedido: false, y: null, o: [] });
  });

  it("interseca las listas AND en una sola, sin repetidos y en el orden de la primera", () => {
    expect(presupuestoDeIds({ y: [["a", "b", "c", "a"], null, ["c", "a", "z"]], o: [] })).toEqual({ excedido: false, y: ["a", "c"], o: [] });
    // Una lista AND vacía deja todo vacío (ninguno cumple).
    expect(presupuestoDeIds({ y: [["a"], []], o: [["a"]] })).toEqual({ excedido: false, y: [], o: [] });
  });

  it("une las listas OR sin repetidos y, con AND, sólo deja las que están en ella", () => {
    expect(presupuestoDeIds({ y: [], o: [["a", "b"], ["b", "c"]] })).toEqual({ excedido: false, y: null, o: ["a", "b", "c"] });
    expect(presupuestoDeIds({ y: [["b", "c", "d"]], o: [["a", "b"], ["c", "x"]] })).toEqual({ excedido: false, y: ["b", "c", "d"], o: ["b", "c"] });
  });

  it("cuenta AND y OR juntas contra el tope: justo en el tope pasa, uno más es excedido", () => {
    expect(presupuestoDeIds({ y: [["a", "b"]], o: [["a"]] }, 3)).toEqual({ excedido: false, y: ["a", "b"], o: ["a"] });
    expect(presupuestoDeIds({ y: [["a", "b"]], o: [["a", "b"]] }, 3)).toEqual({ excedido: true });
    expect(presupuestoDeIds({ y: [], o: [["a", "b"], ["c", "d"]] }, 3)).toEqual({ excedido: true });
    expect(presupuestoDeIds({ y: [["a", "b", "c", "d"]], o: [] }, 3)).toEqual({ excedido: true });
  });

  it("dos listas de 15.000 y 18.000 que cada una cabe en el tope, juntas lo pasan", () => {
    const filtro = rango("x", 15_000);
    const busqueda = rango("x", 18_000);
    expect(filtro.length).toBeLessThanOrEqual(TOPE_IDS_POR_CONSULTA);
    expect(busqueda.length).toBeLessThanOrEqual(TOPE_IDS_POR_CONSULTA);
    // AND 15.000 + OR (filtrada a la AND) 15.000 = 30.000.
    expect(presupuestoDeIds({ y: [filtro], o: [busqueda] })).toEqual({ excedido: true });
    // Dos OR disjuntas: 33.000.
    expect(presupuestoDeIds({ y: [], o: [filtro, rango("n", 18_000)] })).toEqual({ excedido: true });
    // Dos AND: la intersección (15.000) sí cabe.
    const r = presupuestoDeIds({ y: [filtro, busqueda], o: [] });
    expect(r.excedido).toBe(false);
    if (!r.excedido) expect(r.y).toHaveLength(15_000);
  });
});
