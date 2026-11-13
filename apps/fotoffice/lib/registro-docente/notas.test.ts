import { describe, expect, it } from "vitest";
import { aEntero, calcularNotaPeriodo, leerCelda, presentarNota, redondear2, sugerirNotaFinal, textoDeCelda, valorParaMiEscuela, type EvaluacionParaCalculo, type NotaParaCalculo } from "./notas";
import { resolverReglas } from "./reglas";

const BELEN = resolverReglas({
  modelo: "santa-fe-secundaria",
  escuela: { decimales: true, notaAprobacion: 7, limiteFaltas: 15, pesos: { examen: 50, trabajos: 30, carpeta: 10, participacion: 10 }, recuperatorio: "promedia" },
}).valores;

const ev = (id: string, tipo: EvaluacionParaCalculo["tipo"], extra: Partial<EvaluacionParaCalculo> = {}): EvaluacionParaCalculo => ({
  id, tipo, periodo: "T1", notaMaxima: 10, recuperaAId: null, ...extra,
});
const n = (valor: number | null, especial: NotaParaCalculo["especial"] = null): NotaParaCalculo => ({ valor, especial });

describe("calcularNotaPeriodo", () => {
  it("pondera por tipo con los pesos de Belén (50/30/10/10)", () => {
    const evals = [ev("e1", "escrito"), ev("e2", "oral"), ev("t1", "tp"), ev("c", "carpeta"), ev("p", "participacion")];
    const notas = new Map([["e1", n(6)], ["e2", n(8)], ["t1", n(9)], ["c", n(10)], ["p", n(5)]]);
    const r = calcularNotaPeriodo({ periodo: "T1", evaluaciones: evals, notas, reglas: BELEN });
    // exámenes 7 · 0,5 + TP 9 · 0,3 + carpeta 10 · 0,1 + participación 5 · 0,1 = 3,5 + 2,7 + 1 + 0,5
    expect(r.porCategoria.examen).toEqual({ promedio: 7, cantidad: 2 });
    expect(r.sugerida).toBe(7.7);
    expect(r.pendientes).toEqual([]);
    expect(r.sinNotas).toEqual([]);
  });

  it("el recuperatorio se promedia con la nota original", () => {
    const evals = [ev("e1", "escrito"), ev("r1", "escrito", { recuperaAId: "e1" })];
    const r = calcularNotaPeriodo({ periodo: "T1", evaluaciones: evals, notas: new Map([["e1", n(4)], ["r1", n(8)]]), reglas: BELEN });
    expect(r.evaluaciones).toEqual([{ evaluacionId: "e1", nota: 6, pendiente: false }]);
    expect(r.sugerida).toBe(6);
  });

  it("si faltó al examen, vale el recuperatorio entero", () => {
    const evals = [ev("e1", "escrito"), ev("r1", "escrito", { recuperaAId: "e1" })];
    const r = calcularNotaPeriodo({ periodo: "T1", evaluaciones: evals, notas: new Map([["e1", n(null, "AUSENTE")], ["r1", n(8)]]), reglas: BELEN });
    expect(r.sugerida).toBe(8);
    expect(r.pendientes).toEqual([]);
  });

  it("reemplaza y mejor", () => {
    const evals = [ev("e1", "escrito"), ev("r1", "escrito", { recuperaAId: "e1" })];
    const notas = new Map([["e1", n(9)], ["r1", n(5)]]);
    expect(calcularNotaPeriodo({ periodo: "T1", evaluaciones: evals, notas, reglas: { ...BELEN, recuperatorio: "reemplaza" } }).sugerida).toBe(5);
    expect(calcularNotaPeriodo({ periodo: "T1", evaluaciones: evals, notas, reglas: { ...BELEN, recuperatorio: "mejor" } }).sugerida).toBe(9);
  });

  it("ausente sin recuperatorio queda pendiente y no cuenta", () => {
    const evals = [ev("e1", "escrito"), ev("e2", "escrito"), ev("t1", "tp")];
    const r = calcularNotaPeriodo({ periodo: "T1", evaluaciones: evals, notas: new Map([["e1", n(null, "AUSENTE")], ["e2", n(8)]]), reglas: BELEN });
    expect(r.pendientes).toEqual(["e1", "t1"]);
    expect(r.porCategoria.examen.promedio).toBe(8);
    expect(r.sugerida).toBe(8);
    expect(r.sinNotas).toEqual(["trabajos", "carpeta", "participacion"]);
  });

  it("exceptuado no cuenta ni queda pendiente", () => {
    const evals = [ev("e1", "escrito"), ev("t1", "tp")];
    const r = calcularNotaPeriodo({ periodo: "T1", evaluaciones: evals, notas: new Map([["e1", n(null, "EXCEPTUADO")], ["t1", n(9)]]), reglas: BELEN });
    expect(r.pendientes).toEqual([]);
    expect(r.sugerida).toBe(9);
  });

  it("sin notas no sugiere nada", () => {
    const r = calcularNotaPeriodo({ periodo: "T1", evaluaciones: [ev("e1", "escrito")], notas: new Map(), reglas: BELEN });
    expect(r.sugerida).toBeNull();
    expect(r.sinNotas).toEqual([]);
  });

  it("sólo mira el período pedido", () => {
    const evals = [ev("e1", "escrito"), ev("e2", "escrito", { periodo: "T2" })];
    const r = calcularNotaPeriodo({ periodo: "T2", evaluaciones: evals, notas: new Map([["e1", n(2)], ["e2", n(9)]]), reglas: BELEN });
    expect(r.sugerida).toBe(9);
  });

  it("una evaluación sobre 20 se lleva a la escala del 1 al 10", () => {
    const r = calcularNotaPeriodo({ periodo: "T1", evaluaciones: [ev("e1", "escrito", { notaMaxima: 20 })], notas: new Map([["e1", n(15)]]), reglas: BELEN });
    expect(r.sugerida).toBe(7.5);
  });

  it("sin decimales redondea a entero (6,5 → 7)", () => {
    const evals = [ev("e1", "escrito"), ev("e2", "escrito")];
    const r = calcularNotaPeriodo({ periodo: "T1", evaluaciones: evals, notas: new Map([["e1", n(6)], ["e2", n(7)]]), reglas: { ...BELEN, decimales: false } });
    expect(r.sugerida).toBe(7);
  });

  it("varios recuperatorios se aplican en orden de fecha", () => {
    const evals = [ev("e1", "escrito"), ev("r2", "escrito", { recuperaAId: "e1", fecha: "2027-05-20" }), ev("r1", "escrito", { recuperaAId: "e1", fecha: "2027-05-10" })];
    // (2 + 6) / 2 = 4; (4 + 10) / 2 = 7
    const r = calcularNotaPeriodo({ periodo: "T1", evaluaciones: evals, notas: new Map([["e1", n(2)], ["r1", n(6)], ["r2", n(10)]]), reglas: BELEN });
    expect(r.sugerida).toBe(7);
  });
});

describe("redondeo", () => {
  it("dos decimales sin errores de coma flotante", () => {
    expect(redondear2(6.675)).toBe(6.68);
    expect(redondear2(0.1 + 0.2)).toBe(0.3);
  });
  it("a entero según la regla", () => {
    expect(aEntero(6.5, "mitad-arriba")).toBe(7);
    expect(aEntero(6.49, "mitad-arriba")).toBe(6);
    expect(aEntero(6.4999999999, "mitad-arriba")).toBe(7);
    expect(aEntero(6.9, "abajo")).toBe(6);
    expect(aEntero(6.1, "arriba")).toBe(7);
    expect(aEntero(7, "arriba")).toBe(7);
  });
  it("presentarNota respeta la escala", () => {
    expect(presentarNota(11, BELEN)).toBe(10);
    expect(presentarNota(0.2, BELEN)).toBe(1);
  });
});

describe("nota final y Mi Escuela", () => {
  it("la final sugerida promedia los períodos puestos", () => {
    expect(sugerirNotaFinal([7, 8, 9], BELEN)).toEqual({ sugerida: 8, faltan: 0 });
    expect(sugerirNotaFinal([7, null, 8], BELEN)).toEqual({ sugerida: 7.5, faltan: 1 });
    expect(sugerirNotaFinal([null], BELEN)).toEqual({ sugerida: null, faltan: 1 });
  });
  it("Mi Escuela recibe enteros del 1 al 10 o el valor especial", () => {
    expect(valorParaMiEscuela({ final: 6.75, especial: null }, BELEN)).toBe("7");
    expect(valorParaMiEscuela({ final: 6.49, especial: null }, BELEN)).toBe("6");
    expect(valorParaMiEscuela({ final: 0, especial: null }, BELEN)).toBe("1");
    expect(valorParaMiEscuela({ final: null, especial: "EXCEPTUADO" }, BELEN)).toBe("Exceptuado");
    expect(valorParaMiEscuela({ final: null, especial: null }, BELEN)).toBe("");
  });
});

describe("celdas de la planilla", () => {
  it("lee números con coma, tarde y especiales", () => {
    expect(leerCelda("7,5", 10)).toEqual({ ok: true, vacia: false, valor: 7.5, especial: null, entregaTarde: false });
    expect(leerCelda("8t", 10)).toEqual({ ok: true, vacia: false, valor: 8, especial: null, entregaTarde: true });
    expect(leerCelda(" a ", 10)).toMatchObject({ ok: true, especial: "AUSENTE" });
    expect(leerCelda("NE", 10)).toMatchObject({ ok: true, especial: "NO_ENTREGO" });
    expect(leerCelda("", 10)).toEqual({ ok: true, vacia: true });
    expect(leerCelda("11", 10).ok).toBe(false);
    expect(leerCelda("siete", 10).ok).toBe(false);
  });
  it("vuelve a escribir lo guardado", () => {
    expect(textoDeCelda({ valor: 7.5, especial: null, entregaTarde: true })).toBe("7,5t");
    expect(textoDeCelda({ valor: null, especial: "AUSENTE", entregaTarde: false })).toBe("A");
    expect(textoDeCelda(null)).toBe("");
  });
});
