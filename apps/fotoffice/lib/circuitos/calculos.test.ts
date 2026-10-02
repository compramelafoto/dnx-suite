import { describe, expect, it } from "vitest";
import { esRetroceso, estaVencida, proyeccion, validarMovimiento, vencimientoDeEtapa, vencimientoDeTarea } from "./calculos";

const d = (s: string) => new Date(s);
const E = (id: string, order: number, days: number, archivedAt: Date | null = null) => ({ id, order, days, archivedAt });

describe("vencimientos en hora de Buenos Aires", () => {
  it("2 días desde el 30/09 22:00 AR vence el 02/10 al final del día", () =>
    expect(vencimientoDeEtapa(d("2026-10-01T01:00:00Z"), 2)?.toISOString()).toBe("2026-10-03T02:59:59.999Z"));
  it("0 días = sin vencimiento", () => expect(vencimientoDeEtapa(d("2026-10-01T12:00:00Z"), 0)).toBeNull());
  it("tarea de 0 días vence al final del día de entrada", () =>
    expect(vencimientoDeTarea(d("2026-10-01T12:00:00Z"), 0).toISOString()).toBe("2026-10-02T02:59:59.999Z"));
  it("vencida sólo si pasó el instante", () => {
    expect(estaVencida(d("2026-10-02T02:59:59.999Z"), d("2026-10-02T02:59:59.999Z"))).toBe(false);
    expect(estaVencida(d("2026-10-02T02:59:59.999Z"), d("2026-10-02T03:00:00Z"))).toBe(true);
    expect(estaVencida(null, d("2030-01-01T00:00:00Z"))).toBe(false);
  });
});

describe("esRetroceso", () => {
  const etapas = [E("a", 0, 1), E("b", 1, 1), E("c", 2, 1)];
  it("adelante no, atrás o igual sí", () => {
    expect(esRetroceso(etapas, "a", "c")).toBe(false);
    expect(esRetroceso(etapas, "c", "a")).toBe(true);
    expect(esRetroceso(etapas, "b", "b")).toBe(true);
  });
});

describe("validarMovimiento", () => {
  const etapas = [E("a", 0, 1), E("b", 1, 1), E("x", 2, 1, d("2026-01-01T00:00:00Z"))];
  const base = { etapas, actualId: "a", destinoId: "b", requiereTareas: true, pendientesObligatorias: ["Llamar"], forzar: false, puedeForzar: false };
  it("tareas pendientes bloquean", () => expect(validarMovimiento(base)).toEqual({ ok: false, motivo: "TAREAS_PENDIENTES", pendientes: ["Llamar"] }));
  it("forzar sin permiso sigue bloqueado", () => expect(validarMovimiento({ ...base, forzar: true }).ok).toBe(false));
  it("forzar con permiso pasa", () => expect(validarMovimiento({ ...base, forzar: true, puedeForzar: true })).toEqual({ ok: true }));
  it("sin marca de tareas pasa", () => expect(validarMovimiento({ ...base, requiereTareas: false })).toEqual({ ok: true }));
  it("etapa archivada, de otro circuito o la misma", () => {
    expect(validarMovimiento({ ...base, requiereTareas: false, destinoId: "x" })).toMatchObject({ motivo: "ARCHIVADA" });
    expect(validarMovimiento({ ...base, requiereTareas: false, destinoId: "zzz" })).toMatchObject({ motivo: "OTRO_CIRCUITO" });
    expect(validarMovimiento({ ...base, requiereTareas: false, destinoId: "a" })).toMatchObject({ motivo: "MISMA_ETAPA" });
  });
});

describe("proyeccion", () => {
  const etapas = [E("a", 0, 2), E("b", 1, 3), E("c", 2, 0), E("z", 3, 5, d("2026-01-01T00:00:00Z"))];
  it("encadena desde el vencimiento de la actual e ignora archivadas", () => {
    const p = proyeccion(etapas, "a", d("2026-10-01T12:00:00Z"), d("2026-10-04T02:59:59.999Z"), d("2026-10-01T15:00:00Z"));
    expect(p.desdeHoy).toBe(false);
    expect(p.etapas.map((e) => e.id)).toEqual(["a", "b", "c"]);
    expect(p.fin?.toISOString()).toBe("2026-10-07T02:59:59.999Z");
  });
  it("si la actual venció, calcula desde hoy", () => {
    const p = proyeccion(etapas, "a", d("2026-09-01T12:00:00Z"), d("2026-09-04T02:59:59.999Z"), d("2026-10-01T15:00:00Z"));
    expect(p.desdeHoy).toBe(true);
    expect(p.etapas[1].inicio.toISOString() >= "2026-10-01").toBe(true);
  });
});
