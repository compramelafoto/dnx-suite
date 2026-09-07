import { Prisma } from "@repo/db";
import { describe, expect, it } from "vitest";
import {
  MAX_ADVANCE_MONTHS,
  advanceAmountMinorFor,
  advanceCandidatePeriods,
  planAdvancePeriods,
} from "./advance";

const REFERENCE = new Prisma.Decimal("80000.00");
const FLOOR_MULTIPLE = 1;

const DUE_DAY = 10;
/** Un mismo valor repetido para los `n` meses que se piden, el caso más común en los tests. */
const parejo = (amountMinor: number, n: number): number[] => Array(n).fill(amountMinor);

const BASE = { fromPeriod: "2026-10", dueDay: DUE_DAY };

describe("advanceCandidatePeriods", () => {
  it("un mes es un solo período", () => {
    expect(advanceCandidatePeriods("2026-10", 1)).toEqual(["2026-10"]);
  });

  it("varios meses son consecutivos", () => {
    expect(advanceCandidatePeriods("2026-10", 3)).toEqual(["2026-10", "2026-11", "2026-12"]);
  });

  it("cruza el año sin inventar un mes 13", () => {
    expect(advanceCandidatePeriods("2026-11", 3)).toEqual(["2026-11", "2026-12", "2027-01"]);
  });

  it("no devuelve más que el tope", () => {
    expect(advanceCandidatePeriods("2026-10", 99)).toHaveLength(MAX_ADVANCE_MONTHS);
  });

  it("un pedido de cero o negativo no devuelve nada", () => {
    expect(advanceCandidatePeriods("2026-10", 0)).toEqual([]);
    expect(advanceCandidatePeriods("2026-10", -3)).toEqual([]);
  });

  it("un período mal formado no devuelve nada en vez de inventar una fecha", () => {
    expect(advanceCandidatePeriods("octubre", 2)).toEqual([]);
  });
});

describe("advanceAmountMinorFor", () => {
  it("un socio de escala PLENA paga el valor de referencia entero", () => {
    expect(
      advanceAmountMinorFor({
        referenceAmount: REFERENCE,
        scale: "PLENA",
        ownAmount: null,
        floorMultiple: FLOOR_MULTIPLE,
      }),
    ).toBe(8000000);
  });

  it("un socio de escala REDUCIDA paga la mitad, no el valor de referencia entero", () => {
    // Este es el defecto que se corrige: adelantar no puede cobrarle a un REDUCIDA lo mismo
    // que a un PLENA.
    expect(
      advanceAmountMinorFor({
        referenceAmount: REFERENCE,
        scale: "REDUCIDA",
        ownAmount: null,
        floorMultiple: FLOOR_MULTIPLE,
      }),
    ).toBe(4000000);
  });

  it("un socio EXENTA sin monto propio no tiene nada para ofrecer", () => {
    expect(
      advanceAmountMinorFor({
        referenceAmount: REFERENCE,
        scale: "EXENTA",
        ownAmount: null,
        floorMultiple: FLOOR_MULTIPLE,
      }),
    ).toBeNull();
  });

  it("un colaborador paga su monto propio, nunca por debajo del piso", () => {
    expect(
      advanceAmountMinorFor({
        referenceAmount: REFERENCE,
        scale: "PLENA",
        ownAmount: new Prisma.Decimal("150000"),
        floorMultiple: FLOOR_MULTIPLE,
      }),
    ).toBe(15000000);
  });

  it("un monto propio por debajo del piso se sube al piso", () => {
    expect(
      advanceAmountMinorFor({
        referenceAmount: REFERENCE,
        scale: "PLENA",
        ownAmount: new Prisma.Decimal("100"),
        floorMultiple: FLOOR_MULTIPLE,
      }),
    ).toBe(8000000);
  });

  it("sin valor de referencia vigente no se ofrece nada", () => {
    expect(
      advanceAmountMinorFor({
        referenceAmount: null,
        scale: "PLENA",
        ownAmount: null,
        floorMultiple: FLOOR_MULTIPLE,
      }),
    ).toBeNull();
  });
});

describe("planAdvancePeriods", () => {
  it("un mes adelantado es un solo período, a su propio valor", () => {
    expect(planAdvancePeriods({ ...BASE, months: 1, feeValuesMinor: parejo(800000, 1) })).toEqual([
      { period: "2026-10", amountMinor: 800000, dueDate: new Date(Date.UTC(2026, 9, 10)) },
    ]);
  });

  it("varios meses son meses consecutivos", () => {
    const r = planAdvancePeriods({ ...BASE, months: 3, feeValuesMinor: parejo(800000, 3) });
    expect(r.map((p) => p.period)).toEqual(["2026-10", "2026-11", "2026-12"]);
  });

  it("cruza el año sin inventar un mes 13", () => {
    const r = planAdvancePeriods({
      ...BASE,
      fromPeriod: "2026-11",
      months: 3,
      feeValuesMinor: parejo(800000, 3),
    });
    expect(r.map((p) => p.period)).toEqual(["2026-11", "2026-12", "2027-01"]);
  });

  it("no deja adelantar más que el tope", () => {
    expect(
      planAdvancePeriods({ ...BASE, months: 99, feeValuesMinor: parejo(800000, MAX_ADVANCE_MONTHS) }),
    ).toHaveLength(MAX_ADVANCE_MONTHS);
  });

  it("un pedido de cero o negativo no devuelve nada", () => {
    expect(planAdvancePeriods({ ...BASE, months: 0, feeValuesMinor: [] })).toEqual([]);
    expect(planAdvancePeriods({ ...BASE, months: -3, feeValuesMinor: [] })).toEqual([]);
  });

  it("sin valor de cuota no se ofrece nada: no se cobra un precio que no está fijado", () => {
    expect(planAdvancePeriods({ ...BASE, months: 3, feeValuesMinor: [0, 0, 0] })).toEqual([]);
  });

  it("un mes sin valor vigente se salta sin cortar los siguientes", () => {
    // Noviembre todavía no tiene un valor de cuota cargado (por ejemplo, recién se creó la
    // categoría): se lo salta, pero octubre y diciembre sí se ofrecen.
    const r = planAdvancePeriods({
      ...BASE,
      months: 3,
      feeValuesMinor: [800000, null, 800000],
    });
    expect(r.map((p) => p.period)).toEqual(["2026-10", "2026-12"]);
  });

  it("el importe puede variar de un mes a otro, por ejemplo por un aumento ya resuelto", () => {
    const r = planAdvancePeriods({
      ...BASE,
      months: 2,
      feeValuesMinor: [800000, 900000],
    });
    expect(r).toEqual([
      { period: "2026-10", amountMinor: 800000, dueDate: new Date(Date.UTC(2026, 9, 10)) },
      { period: "2026-11", amountMinor: 900000, dueDate: new Date(Date.UTC(2026, 10, 10)) },
    ]);
  });

  it("un mes con menos días no corre el vencimiento al mes siguiente", () => {
    // Día 31 en febrero: se topea, nunca se desborda.
    const r = planAdvancePeriods({
      fromPeriod: "2027-02",
      months: 1,
      feeValuesMinor: [800000],
      dueDay: 31,
    });
    expect(r[0]?.dueDate).toEqual(new Date(Date.UTC(2027, 1, 28)));
  });

  it("un período mal formado no devuelve nada en vez de inventar una fecha", () => {
    expect(
      planAdvancePeriods({ ...BASE, fromPeriod: "octubre", months: 2, feeValuesMinor: [800000, 800000] }),
    ).toEqual([]);
  });

  describe("validaciones de seguridad en feeValuesMinor", () => {
    it("feeValueMinor = NaN no produce ese período", () => {
      expect(planAdvancePeriods({ ...BASE, months: 1, feeValuesMinor: [NaN] })).toEqual([]);
    });

    it("feeValueMinor = Infinity no produce ese período", () => {
      expect(planAdvancePeriods({ ...BASE, months: 1, feeValuesMinor: [Infinity] })).toEqual([]);
    });

    it("feeValueMinor con decimales (no entero) no produce ese período", () => {
      expect(planAdvancePeriods({ ...BASE, months: 1, feeValuesMinor: [800000.55] })).toEqual([]);
    });

    it("feeValueMinor negativo no produce ese período", () => {
      expect(planAdvancePeriods({ ...BASE, months: 1, feeValuesMinor: [-800000] })).toEqual([]);
    });

    it("falta la entrada del período (array más corto) no produce ese período", () => {
      expect(planAdvancePeriods({ ...BASE, months: 1, feeValuesMinor: [] })).toEqual([]);
    });
  });

  describe("validaciones de seguridad en dueDay", () => {
    it("dueDay = NaN no produce períodos", () => {
      expect(planAdvancePeriods({ ...BASE, months: 1, feeValuesMinor: [800000], dueDay: NaN })).toEqual(
        [],
      );
    });

    it("dueDay = 0 no produce períodos", () => {
      expect(planAdvancePeriods({ ...BASE, months: 1, feeValuesMinor: [800000], dueDay: 0 })).toEqual(
        [],
      );
    });

    it("dueDay negativo no produce períodos", () => {
      expect(planAdvancePeriods({ ...BASE, months: 1, feeValuesMinor: [800000], dueDay: -1 })).toEqual(
        [],
      );
    });

    it("dueDay = 32 (fuera de rango) no produce períodos", () => {
      expect(planAdvancePeriods({ ...BASE, months: 1, feeValuesMinor: [800000], dueDay: 32 })).toEqual(
        [],
      );
    });
  });
});
