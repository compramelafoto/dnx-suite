import { describe, expect, it } from "vitest";
import { imputarAutomatico, imputarConPreferida, validarImputacionManual, type CuotaConSaldo } from "./imputacion";

const CUOTAS: CuotaConSaldo[] = [
  // Desordenadas a propósito: el orden sale del vencimiento, no del arreglo.
  { id: "c3", position: 3, dueDate: "2026-12-08", saldo: 1000 },
  { id: "c1", position: 1, dueDate: "2026-10-08", saldo: 1000 },
  { id: "c2", position: 2, dueDate: "2026-11-08", saldo: 1000 },
];

describe("imputarAutomatico", () => {
  it("un cobro parcial queda en la cuota más vieja", () => {
    expect(imputarAutomatico(CUOTAS, 400)).toEqual({ ok: true, imputaciones: [{ cuotaId: "c1", amountArs: 400 }] });
  });

  it("reparte entre varias cuotas de la más vieja a la más nueva", () => {
    expect(imputarAutomatico(CUOTAS, 2500.5)).toEqual({
      ok: true,
      imputaciones: [
        { cuotaId: "c1", amountArs: 1000 },
        { cuotaId: "c2", amountArs: 1000 },
        { cuotaId: "c3", amountArs: 500.5 },
      ],
    });
  });

  it("saltea las cuotas ya pagadas", () => {
    const cuotas = [{ ...CUOTAS[1]!, saldo: 0 }, CUOTAS[2]!, { ...CUOTAS[0]!, saldo: 250.25 }];
    expect(imputarAutomatico(cuotas, 300)).toEqual({ ok: true, imputaciones: [{ cuotaId: "c2", amountArs: 300 }] });
  });

  it("a igual vencimiento ordena por posición", () => {
    const cuotas: CuotaConSaldo[] = [
      { id: "b", position: 2, dueDate: "2026-10-08", saldo: 10 },
      { id: "a", position: 1, dueDate: "2026-10-08", saldo: 10 },
    ];
    expect(imputarAutomatico(cuotas, 15)).toEqual({
      ok: true,
      imputaciones: [
        { cuotaId: "a", amountArs: 10 },
        { cuotaId: "b", amountArs: 5 },
      ],
    });
  });

  it("acepta el saldo exacto y rechaza si lo supera (nunca crea deuda nueva)", () => {
    expect(imputarAutomatico(CUOTAS, 3000).ok).toBe(true);
    expect(imputarAutomatico(CUOTAS, 3000.01)).toEqual({ ok: false, error: "El importe supera el saldo del pedido." });
  });

  it("rechaza importes cero, negativos o con más de dos decimales", () => {
    expect(imputarAutomatico(CUOTAS, 0).ok).toBe(false);
    expect(imputarAutomatico(CUOTAS, -5).ok).toBe(false);
    expect(imputarAutomatico(CUOTAS, 1.005).ok).toBe(false);
    expect(imputarAutomatico(CUOTAS, Number.NaN).ok).toBe(false);
  });

  it("suma a centavos sin errores de flotante", () => {
    const cuotas: CuotaConSaldo[] = [
      { id: "a", position: 1, dueDate: "2026-10-08", saldo: 0.1 },
      { id: "b", position: 2, dueDate: "2026-11-08", saldo: 0.2 },
    ];
    expect(imputarAutomatico(cuotas, 0.3)).toEqual({
      ok: true,
      imputaciones: [
        { cuotaId: "a", amountArs: 0.1 },
        { cuotaId: "b", amountArs: 0.2 },
      ],
    });
  });
});

describe("validarImputacionManual", () => {
  it("acepta una imputación a mano que suma el importe", () => {
    const r = validarImputacionManual(
      CUOTAS,
      [
        { cuotaId: "c3", amountArs: 1000 },
        { cuotaId: "c1", amountArs: 200 },
      ],
      1200,
    );
    expect(r.ok).toBe(true);
  });

  it("rechaza cuotas ajenas, repetidas, por encima del saldo o que no suman", () => {
    expect(validarImputacionManual(CUOTAS, [{ cuotaId: "otra", amountArs: 10 }], 10)).toEqual({
      ok: false,
      error: "Una de las cuotas no es de este pedido.",
    });
    expect(
      validarImputacionManual(
        CUOTAS,
        [
          { cuotaId: "c1", amountArs: 10 },
          { cuotaId: "c1", amountArs: 10 },
        ],
        20,
      ).ok,
    ).toBe(false);
    expect(validarImputacionManual(CUOTAS, [{ cuotaId: "c1", amountArs: 1000.01 }], 1000.01)).toEqual({
      ok: false,
      error: "Lo imputado a la cuota 1 supera su saldo.",
    });
    expect(validarImputacionManual(CUOTAS, [{ cuotaId: "c1", amountArs: 100 }], 150)).toEqual({
      ok: false,
      error: "Lo imputado a las cuotas tiene que sumar el importe del cobro.",
    });
    expect(validarImputacionManual(CUOTAS, [{ cuotaId: "c1", amountArs: 0 }], 0).ok).toBe(false);
    expect(validarImputacionManual(CUOTAS, [], 100).ok).toBe(false);
  });
});

describe("imputarConPreferida", () => {
  it("va primero a la preferida y el resto de la más vieja a la más nueva", () => {
    expect(imputarConPreferida(CUOTAS, 1500, "c2")).toEqual({
      ok: true,
      imputaciones: [{ cuotaId: "c2", amountArs: 1000 }, { cuotaId: "c1", amountArs: 500 }],
    });
  });

  it("un importe menor que el saldo de la preferida va sólo a ella", () => {
    expect(imputarConPreferida(CUOTAS, 300.5, "c3")).toEqual({ ok: true, imputaciones: [{ cuotaId: "c3", amountArs: 300.5 }] });
  });

  it("sin preferida, o con una paga o ajena, es el automático común", () => {
    const pagas = CUOTAS.map((c) => (c.id === "c2" ? { ...c, saldo: 0 } : c));
    expect(imputarConPreferida(pagas, 1500, "c2")).toEqual(imputarAutomatico(pagas, 1500));
    expect(imputarConPreferida(CUOTAS, 500, null)).toEqual(imputarAutomatico(CUOTAS, 500));
    expect(imputarConPreferida(CUOTAS, 500, "otra")).toEqual(imputarAutomatico(CUOTAS, 500));
  });

  it("rechaza lo que supera el saldo total o no es un importe válido", () => {
    expect(imputarConPreferida(CUOTAS, 3000.01, "c2")).toEqual({ ok: false, error: "El importe supera el saldo del pedido." });
    expect(imputarConPreferida(CUOTAS, 0, "c2").ok).toBe(false);
    expect(imputarConPreferida(CUOTAS, 10.123, "c2").ok).toBe(false);
  });
});
