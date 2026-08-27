import { describe, expect, it } from "vitest";
import { selectChargesToPay, sortOldestFirst, type OpenCharge } from "./select-charges";

function cargo(period: string, balanceMinor: number, dia = 10): OpenCharge {
  const [anio, mes] = period.split("-").map(Number);
  return {
    id: `c-${period}`,
    concept: "MENSUAL",
    period,
    dueDate: new Date(Date.UTC(anio ?? 2026, (mes ?? 1) - 1, dia)),
    balanceMinor,
  };
}

const junio = cargo("2026-06", 4700000);
const julio = cargo("2026-07", 4700000);
const agosto = cargo("2026-08", 4700000);

describe("selectChargesToPay", () => {
  it("sin cuotas pendientes, no hay nada que cobrar", () => {
    const r = selectChargesToPay([]);
    expect(r.ok).toBe(false);
  });

  it("un cargo ya cancelado no cuenta como pendiente", () => {
    const r = selectChargesToPay([cargo("2026-06", 0)]);
    expect(r.ok).toBe(false);
  });

  it("por omisión paga todo lo que se debe", () => {
    const r = selectChargesToPay([agosto, junio, julio]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.selection.totalMinor).toBe(4700000 * 3);
    expect(r.selection.remaining).toBe(0);
  });

  it("imputa de la más vieja a la más nueva, sin importar el orden que llegue", () => {
    const r = selectChargesToPay([agosto, junio, julio], { howMany: 2 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.selection.chargeIds).toEqual(["c-2026-06", "c-2026-07"]);
    expect(r.selection.oldestPeriod).toBe("2026-06");
    expect(r.selection.remaining).toBe(1);
  });

  it("pagar una sola paga la más vieja, nunca la que el socio prefiera", () => {
    // Dejar junio impaga y cancelar agosto haría figurar al socio al día y con tres meses
    // de atraso a la vez.
    const r = selectChargesToPay([agosto, junio], { howMany: 1 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.selection.chargeIds).toEqual(["c-2026-06"]);
  });

  it("pedir más cuotas de las que se deben paga las que hay", () => {
    const r = selectChargesToPay([junio], { howMany: 99 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.selection.chargeIds).toEqual(["c-2026-06"]);
    expect(r.selection.remaining).toBe(0);
  });

  it("rechaza una cantidad que no es un entero positivo", () => {
    expect(selectChargesToPay([junio], { howMany: 0 }).ok).toBe(false);
    expect(selectChargesToPay([junio], { howMany: -1 }).ok).toBe(false);
    expect(selectChargesToPay([junio], { howMany: 1.5 }).ok).toBe(false);
  });

  it("suma el saldo, no el importe original: un cargo pagado a medias cobra lo que falta", () => {
    const parcial = { ...cargo("2026-06", 1200000) };
    const r = selectChargesToPay([parcial, julio]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.selection.totalMinor).toBe(1200000 + 4700000);
  });

  it("con el mismo vencimiento, el orden es estable y no depende del azar", () => {
    const a = { ...cargo("2026-06", 100), id: "a" };
    const b = { ...cargo("2026-05", 100), id: "b", dueDate: a.dueDate };
    expect(sortOldestFirst([a, b]).map((c) => c.id)).toEqual(["b", "a"]);
    expect(sortOldestFirst([b, a]).map((c) => c.id)).toEqual(["b", "a"]);
  });

  it("mezcla conceptos: el ingreso vence antes y se cobra primero", () => {
    const ingreso: OpenCharge = { ...cargo("2026-06", 9400000), id: "ing", concept: "INGRESO", dueDate: new Date(Date.UTC(2026, 5, 1)) };
    const r = selectChargesToPay([julio, ingreso], { howMany: 1 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.selection.chargeIds).toEqual(["ing"]);
  });
});

describe("selectChargesToPay — cuotas de ingreso", () => {
  const ingreso = (period: string, id: string): OpenCharge => ({
    id,
    concept: "INGRESO",
    period,
    dueDate: new Date(`${period}-10T00:00:00Z`),
    balanceMinor: 4_000_00,
  });

  /**
   * La inscripción es un solo pago. Dejar pagar una de las tres convertiría el ingreso en un
   * plan de cuotas que nadie acordó, y el socio quedaría a mitad de camino: ni afuera ni
   * habilitado.
   */
  it("con cuotas de ingreso impagas se cobran las tres juntas, aunque pidan una", () => {
    const r = selectChargesToPay(
      [ingreso("2026-09", "a"), ingreso("2026-10", "b"), ingreso("2026-11", "c")],
      { howMany: 1 },
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.selection.chargeIds).toHaveLength(3);
      expect(r.selection.totalMinor).toBe(12_000_00);
    }
  });

  it("pedir ALL sobre ingreso da lo mismo: las tres", () => {
    const r = selectChargesToPay([ingreso("2026-09", "a"), ingreso("2026-10", "b")], {
      howMany: "ALL",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.selection.chargeIds).toHaveLength(2);
  });

  /** Saldada la inscripción, las mensuales vuelven a poder pagarse de a una. */
  it("sin ingreso impago, las mensuales se siguen eligiendo por cantidad", () => {
    const mensual = (period: string, id: string): OpenCharge => ({
      id,
      concept: "MENSUAL",
      period,
      dueDate: new Date(`${period}-10T00:00:00Z`),
      balanceMinor: 8_000_00,
    });
    const r = selectChargesToPay([mensual("2026-09", "a"), mensual("2026-10", "b")], {
      howMany: 1,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.selection.chargeIds).toEqual(["a"]);
  });

  /** Si quedó saldo de ingreso, arrastra también las mensuales: primero se cierra el ingreso. */
  it("el ingreso impago manda aunque haya mensuales más nuevas", () => {
    const r = selectChargesToPay(
      [
        ingreso("2026-09", "a"),
        { id: "m", concept: "MENSUAL", period: "2026-12", dueDate: new Date("2026-12-10T00:00:00Z"), balanceMinor: 8_000_00 },
      ],
      { howMany: 1 },
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.selection.chargeIds).toEqual(["a"]);
  });
});
