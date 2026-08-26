import { describe, expect, it } from "vitest";
import {
  findAbandoned,
  MAX_AGE_MS,
  MIN_AGE_MS,
  selectPaymentsToReconcile,
  type PendingPayment,
} from "./reconcile-policy";

const ahora = new Date("2026-08-26T12:00:00.000Z");
function pago(id: string, edadMs: number): PendingPayment {
  return { id, workspaceId: "w1", createdAt: new Date(ahora.getTime() - edadMs) };
}

describe("selectPaymentsToReconcile", () => {
  it("no pregunta por un pago recién iniciado", () => {
    // El aviso normal llega en segundos: consultarlo sería puro ruido.
    const r = selectPaymentsToReconcile([pago("nuevo", 30 * 1000)], { now: ahora });
    expect(r).toHaveLength(0);
  });

  it("pregunta por uno que ya pasó la espera mínima", () => {
    const r = selectPaymentsToReconcile([pago("viejo", MIN_AGE_MS + 1000)], { now: ahora });
    expect(r.map((p) => p.id)).toEqual(["viejo"]);
  });

  it("deja de preguntar por uno fuera de la ventana", () => {
    // El efectivo vence a las 72 horas; uno de una semana no se acredita solo, y seguir
    // consultándolo cada hora para siempre es una fuga silenciosa.
    const r = selectPaymentsToReconcile([pago("abandonado", MAX_AGE_MS + 1000)], { now: ahora });
    expect(r).toHaveLength(0);
  });

  it("los más viejos primero", () => {
    const r = selectPaymentsToReconcile(
      [
        pago("medio", 2 * 60 * 60 * 1000),
        pago("mas-viejo", 24 * 60 * 60 * 1000),
        pago("reciente", MIN_AGE_MS + 1000),
      ],
      { now: ahora },
    );
    expect(r.map((p) => p.id)).toEqual(["mas-viejo", "medio", "reciente"]);
  });

  it("respeta el tope por corrida", () => {
    const muchos = Array.from({ length: 200 }, (_, i) => pago(`p${i}`, MIN_AGE_MS + i * 1000));
    expect(selectPaymentsToReconcile(muchos, { now: ahora })).toHaveLength(50);
    expect(selectPaymentsToReconcile(muchos, { now: ahora, maxPerRun: 3 })).toHaveLength(3);
  });

  it("justo en los bordes de la ventana, entra", () => {
    expect(selectPaymentsToReconcile([pago("a", MIN_AGE_MS)], { now: ahora })).toHaveLength(1);
    expect(selectPaymentsToReconcile([pago("b", MAX_AGE_MS)], { now: ahora })).toHaveLength(1);
  });
});

describe("findAbandoned", () => {
  it("señala los que salieron de la ventana para mirarlos a mano", () => {
    const r = findAbandoned([pago("viejo", MAX_AGE_MS + 1), pago("nuevo", 1000)], { now: ahora });
    expect(r.map((p) => p.id)).toEqual(["viejo"]);
  });
});
