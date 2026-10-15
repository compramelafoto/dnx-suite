import { describe, expect, it } from "vitest";
import {
  aCentavos,
  diasEntre,
  generarPlan,
  mesesCompletos,
  planDesdeOpcion,
  repartirImporte,
  sumarMeses,
  validarPlan,
} from "./plan-cuotas";

const suma = (cuotas: { amountArs: number }[]) => cuotas.reduce((s, c) => s + aCentavos(c.amountArs), 0);

describe("fechas", () => {
  it("sumarMeses conserva el día y lo acota al fin de mes", () => {
    expect(sumarMeses("2026-10-08", 1)).toBe("2026-11-08");
    expect(sumarMeses("2026-01-31", 1)).toBe("2026-02-28");
    expect(sumarMeses("2028-01-31", 1)).toBe("2028-02-29");
    expect(sumarMeses("2026-08-31", 1)).toBe("2026-09-30");
    expect(sumarMeses("2026-11-30", 3)).toBe("2027-02-28");
  });

  it("mesesCompletos cuenta meses enteros de calendario", () => {
    expect(mesesCompletos("2026-10-08", "2026-12-07")).toBe(1);
    expect(mesesCompletos("2026-10-08", "2026-12-08")).toBe(2);
    expect(mesesCompletos("2026-10-08", "2026-10-30")).toBe(0);
    expect(mesesCompletos("2026-10-08", "2027-10-08")).toBe(12);
    expect(mesesCompletos("2026-01-31", "2026-02-28")).toBe(1);
    expect(mesesCompletos("2026-10-08", "2026-09-01")).toBe(0);
  });

  it("diasEntre", () => {
    expect(diasEntre("2026-10-08", "2026-11-08")).toBe(31);
    expect(diasEntre("2026-11-08", "2026-10-08")).toBe(-31);
  });
});

describe("repartirImporte", () => {
  it("partes iguales a centavos y la última absorbe la diferencia", () => {
    expect(repartirImporte(100, 3)).toEqual([33.33, 33.33, 33.34]);
    expect(repartirImporte(1_000_000, 6)).toEqual([166_666.66, 166_666.66, 166_666.66, 166_666.66, 166_666.66, 166_666.7]);
    expect(repartirImporte(0.1 + 0.2, 1)).toEqual([0.3]);
  });
});

describe("generarPlan", () => {
  it("mensual desde el día de confirmación, sin evento", () => {
    const plan = generarPlan({ total: 300_000, cuotas: 3, desde: "2026-10-08" });
    expect(plan).toEqual([
      { position: 1, dueDate: "2026-10-08", amountArs: 100_000 },
      { position: 2, dueDate: "2026-11-08", amountArs: 100_000 },
      { position: 3, dueDate: "2026-12-08", amountArs: 100_000 },
    ]);
  });

  it("redondeo: la suma da el total exacto", () => {
    for (const [total, n] of [
      [100, 3],
      [1_234_567.89, 7],
      [0.05, 3],
      [999_999.99, 12],
    ] as const) {
      const plan = generarPlan({ total, cuotas: n, desde: "2026-10-08" });
      expect(suma(plan)).toBe(aCentavos(total));
      expect(plan.every((c) => c.amountArs > 0)).toBe(true);
    }
  });

  it("nunca hay más cuotas que centavos (ninguna queda en cero)", () => {
    const plan = generarPlan({ total: 0.02, cuotas: 6, desde: "2026-10-08" });
    expect(plan.map((c) => c.amountArs)).toEqual([0.01, 0.01]);
  });

  it("fin de mes: el día 31 queda en el último día de los meses cortos", () => {
    const plan = generarPlan({ total: 400, cuotas: 4, desde: "2026-01-31" });
    expect(plan.map((c) => c.dueDate)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
  });

  it("si la última cuota mensual cae antes o el día del evento, queda mensual", () => {
    const plan = generarPlan({ total: 300, cuotas: 3, desde: "2026-10-08", fechaEvento: "2026-12-08" });
    expect(plan.map((c) => c.dueDate)).toEqual(["2026-10-08", "2026-11-08", "2026-12-08"]);
  });

  it("tope por evento: si no entran, se reparten parejas hasta el día del evento", () => {
    const plan = generarPlan({ total: 600, cuotas: 6, desde: "2026-10-08", fechaEvento: "2026-12-08" });
    // 61 días entre el 8/10 y el 8/12, en 5 tramos: 0, 12.2, 24.4, 36.6, 48.8, 61 → redondeado a días.
    expect(plan.map((c) => c.dueDate)).toEqual([
      "2026-10-08",
      "2026-10-20",
      "2026-11-01",
      "2026-11-14",
      "2026-11-26",
      "2026-12-08",
    ]);
    expect(suma(plan)).toBe(60_000);
  });

  it("evento el mismo día de la confirmación: todas vencen ese día", () => {
    const plan = generarPlan({ total: 300, cuotas: 3, desde: "2026-10-08", fechaEvento: "2026-10-08" });
    expect(plan.map((c) => c.dueDate)).toEqual(["2026-10-08", "2026-10-08", "2026-10-08"]);
  });

  it("evento pasado: una sola cuota que vence el día de la confirmación", () => {
    const plan = generarPlan({ total: 300, cuotas: 3, desde: "2026-10-08", fechaEvento: "2026-09-30" });
    expect(plan).toEqual([{ position: 1, dueDate: "2026-10-08", amountArs: 300 }]);
  });

  it("total cero: no hay plan", () => {
    expect(generarPlan({ total: 0, cuotas: 3, desde: "2026-10-08" })).toEqual([]);
    expect(generarPlan({ total: 0.004, cuotas: 3, desde: "2026-10-08" })).toEqual([]);
  });

  it("cuotas inválidas cuentan como una", () => {
    expect(generarPlan({ total: 100, cuotas: 0, desde: "2026-10-08" })).toHaveLength(1);
    expect(generarPlan({ total: 100, cuotas: Number.NaN, desde: "2026-10-08" })).toHaveLength(1);
  });

  it("rechaza fechas que no existen", () => {
    expect(() => generarPlan({ total: 100, cuotas: 1, desde: "2026-02-30" })).toThrow(RangeError);
    expect(() => generarPlan({ total: 100, cuotas: 1, desde: "2026-10-08", fechaEvento: "08/12/2026" })).toThrow(
      RangeError,
    );
  });
});

describe("planDesdeOpcion", () => {
  it("contado: 1 cuota que vence el día de la confirmación", () => {
    const r = planDesdeOpcion({ cuotas: 1, total: 90_000 }, { desde: "2026-10-08", fechaEvento: "2027-03-01" });
    expect(r).toEqual({ cuotas: [{ position: 1, dueDate: "2026-10-08", amountArs: 90_000 }], aviso: null });
  });

  it("avisa el tope por evento y el evento pasado", () => {
    expect(planDesdeOpcion({ cuotas: 6, total: 600 }, { desde: "2026-10-08", fechaEvento: "2026-12-08" }).aviso).toBe(
      "TOPE_EVENTO",
    );
    expect(planDesdeOpcion({ cuotas: 3, total: 300 }, { desde: "2026-10-08", fechaEvento: "2026-12-08" }).aviso).toBeNull();
    const pasado = planDesdeOpcion({ cuotas: 3, total: 300 }, { desde: "2026-10-08", fechaEvento: "2026-10-01" });
    expect(pasado.aviso).toBe("EVENTO_PASADO");
    expect(pasado.cuotas).toHaveLength(1);
  });

  it("total cero: sin cuotas ni aviso", () => {
    expect(planDesdeOpcion({ cuotas: 3, total: 0 }, { desde: "2026-10-08", fechaEvento: "2026-10-01" })).toEqual({
      cuotas: [],
      aviso: null,
    });
  });
});

describe("validarPlan", () => {
  it("acepta un plan que suma el total exacto", () => {
    expect(
      validarPlan(
        [
          { dueDate: "2026-10-08", amountArs: 33.33 },
          { dueDate: "2026-11-08", amountArs: 33.33 },
          { dueDate: "2026-12-08", amountArs: 33.34 },
        ],
        100,
      ),
    ).toEqual({ ok: true });
  });

  it("rechaza si no suma el total, con la diferencia", () => {
    expect(validarPlan([{ dueDate: "2026-10-08", amountArs: 90 }], 100)).toEqual({
      ok: false,
      error: "Las cuotas suman menos que el total del pedido (faltan $ 10,00).",
    });
    expect(validarPlan([{ dueDate: "2026-10-08", amountArs: 100.5 }], 100)).toEqual({
      ok: false,
      error: "Las cuotas suman más que el total del pedido (sobran $ 0,50).",
    });
  });

  it("rechaza importes cero, negativos o con más de dos decimales, y fechas inválidas", () => {
    expect(validarPlan([{ dueDate: "2026-10-08", amountArs: 0 }, { dueDate: "2026-10-08", amountArs: 100 }], 100).ok).toBe(
      false,
    );
    expect(validarPlan([{ dueDate: "2026-10-08", amountArs: 100.001 }], 100.001).ok).toBe(false);
    expect(validarPlan([{ dueDate: "2026-13-01", amountArs: 100 }], 100).ok).toBe(false);
    expect(validarPlan([], 100).ok).toBe(false);
  });

  it("total cero: el plan tiene que estar vacío", () => {
    expect(validarPlan([], 0)).toEqual({ ok: true });
    expect(validarPlan([{ dueDate: "2026-10-08", amountArs: 1 }], 0).ok).toBe(false);
  });

  it("valida un plan generado", () => {
    const plan = generarPlan({ total: 1_234_567.89, cuotas: 7, desde: "2026-10-31", fechaEvento: "2027-01-15" });
    expect(validarPlan(plan, 1_234_567.89)).toEqual({ ok: true });
  });
});
