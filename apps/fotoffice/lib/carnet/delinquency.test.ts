import { describe, expect, it } from "vitest";
import { computeDelinquency, type DuesCharge } from "./delinquency";

const CUOTA = 4700000;
function mensual(period: string, balanceMinor = CUOTA): DuesCharge {
  return { concept: "MENSUAL", period, balanceMinor };
}
function pagada(period: string): DuesCharge {
  return { concept: "MENSUAL", period, balanceMinor: 0 };
}

describe("computeDelinquency", () => {
  it("un socio al día no está en mora", () => {
    const r = computeDelinquency([pagada("2026-06"), pagada("2026-07"), pagada("2026-08")]);
    expect(r.delinquent).toBe(false);
    expect(r.unpaidTotal).toBe(0);
  });

  it("dos seguidas todavía no dispara", () => {
    const r = computeDelinquency([pagada("2026-06"), mensual("2026-07"), mensual("2026-08")]);
    expect(r.currentConsecutive).toBe(2);
    expect(r.delinquent).toBe(false);
  });

  it("tres seguidas dispara", () => {
    const r = computeDelinquency([mensual("2026-06"), mensual("2026-07"), mensual("2026-08")]);
    expect(r.longestConsecutive).toBe(3);
    expect(r.delinquent).toBe(true);
  });

  it("cinco alternadas dispara aunque nunca haya tres seguidas", () => {
    const r = computeDelinquency([
      mensual("2026-01"), pagada("2026-02"),
      mensual("2026-03"), pagada("2026-04"),
      mensual("2026-05"), pagada("2026-06"),
      mensual("2026-07"), pagada("2026-08"),
      mensual("2026-09"),
    ]);
    expect(r.longestConsecutive).toBe(1);
    expect(r.unpaidTotal).toBe(5);
    expect(r.delinquent).toBe(true);
  });

  it("cuatro alternadas todavía no dispara", () => {
    const r = computeDelinquency([
      mensual("2026-01"), pagada("2026-02"),
      mensual("2026-03"), pagada("2026-04"),
      mensual("2026-05"), pagada("2026-06"),
      mensual("2026-07"),
    ]);
    expect(r.unpaidTotal).toBe(4);
    expect(r.delinquent).toBe(false);
  });

  it("un pago parcial NO corta la racha", () => {
    // La racha se mide sobre cargos con saldo cero. Pagar $100 de una cuota de $47.000 no
    // la convierte en paga.
    const r = computeDelinquency([mensual("2026-06"), mensual("2026-07", 100), mensual("2026-08")]);
    expect(r.longestConsecutive).toBe(3);
    expect(r.delinquent).toBe(true);
  });

  it("las cuotas de ingreso no integran la racha", () => {
    // El socio recién asociado tiene tres cargos de ingreso abiertos por definición.
    // Contarlas lo dejaría en mora el primer día.
    const r = computeDelinquency([
      { concept: "INGRESO", period: "2026-06", balanceMinor: CUOTA },
      { concept: "INGRESO", period: "2026-07", balanceMinor: CUOTA },
      { concept: "INGRESO", period: "2026-08", balanceMinor: CUOTA },
    ]);
    expect(r.unpaidTotal).toBe(0);
    expect(r.delinquent).toBe(false);
  });

  it("el orden en que llegan los cargos no cambia el resultado", () => {
    const cargos = [mensual("2026-08"), pagada("2026-06"), mensual("2026-07")];
    const alReves = [...cargos].reverse();
    expect(computeDelinquency(cargos)).toEqual(computeDelinquency(alReves));
  });

  it("la racha actual solo cuenta la que llega hasta el final", () => {
    const r = computeDelinquency([
      mensual("2026-01"), mensual("2026-02"), mensual("2026-03"),
      pagada("2026-04"),
      mensual("2026-05"),
    ]);
    expect(r.longestConsecutive).toBe(3);
    expect(r.currentConsecutive).toBe(1);
  });

  it("los umbrales se pueden configurar por institución", () => {
    const dosSeguidas = [mensual("2026-07"), mensual("2026-08")];
    expect(computeDelinquency(dosSeguidas).delinquent).toBe(false);
    expect(computeDelinquency(dosSeguidas, { maxConsecutive: 2 }).delinquent).toBe(true);
  });

  it("sin cargos, no hay mora", () => {
    expect(computeDelinquency([]).delinquent).toBe(false);
  });
});
