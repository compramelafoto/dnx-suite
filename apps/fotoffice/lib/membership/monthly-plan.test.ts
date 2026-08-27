import { describe, expect, it } from "vitest";
import { Prisma } from "@repo/db";
import { periodOf, planMonthlyCharges, type MemberForDues } from "./monthly-plan";

const CUOTA = new Prisma.Decimal("47000.00");

function socio(over: Partial<MemberForDues> = {}): MemberForDues {
  return {
    id: "m1",
    status: "ACTIVE",
    joinedAt: new Date(Date.UTC(2020, 0, 1)),
    feeScale: "PLENA",
    ownDuesAmount: null,
    categoryId: "cat1",
    categoryGeneratesDues: true,
    referenceAmount: CUOTA,
    ...over,
  };
}

const base = {
  period: "2026-09",
  dueDay: 10,
  floorMultiple: 1,
  countJoinMonthIfBeforeDueDay: true,
};

describe("planMonthlyCharges", () => {
  it("genera la cuota de un socio activo", () => {
    const r = planMonthlyCharges({ ...base, members: [socio()] });
    expect(r.charges).toHaveLength(1);
    expect(r.charges[0]?.amountArs.toString()).toBe("47000");
    expect(r.charges[0]?.period).toBe("2026-09");
    expect(r.charges[0]?.dueDate.toISOString()).toBe("2026-09-10T00:00:00.000Z");
  });

  it("un suspendido sigue debiendo: la suspensión es sanción, no exención", () => {
    const r = planMonthlyCharges({ ...base, members: [socio({ status: "SUSPENDED" })] });
    expect(r.charges).toHaveLength(1);
  });

  it("un socio dado de baja no genera cuotas nuevas", () => {
    const r = planMonthlyCharges({ ...base, members: [socio({ status: "INACTIVE" })] });
    expect(r.charges).toHaveLength(0);
    expect(r.skipped[0]?.reason).toBe("no está activo");
  });

  it("la escala reducida paga la mitad", () => {
    const r = planMonthlyCharges({ ...base, members: [socio({ feeScale: "REDUCIDA" })] });
    expect(r.charges[0]?.amountArs.toString()).toBe("23500");
  });

  it("el exento no genera cargo", () => {
    const r = planMonthlyCharges({ ...base, members: [socio({ feeScale: "EXENTA" })] });
    expect(r.charges).toHaveLength(0);
    expect(r.skipped[0]?.reason).toBe("está exento");
  });

  it("una categoría que no genera cuotas se saltea", () => {
    const r = planMonthlyCharges({ ...base, members: [socio({ categoryGeneratesDues: false })] });
    expect(r.charges).toHaveLength(0);
    expect(r.skipped[0]?.reason).toBe("su categoría no genera cuotas");
  });

  it("un aporte propio se respeta, pero nunca por debajo del piso", () => {
    const generoso = planMonthlyCharges({
      ...base,
      members: [socio({ ownDuesAmount: new Prisma.Decimal("80000") })],
    });
    expect(generoso.charges[0]?.amountArs.toString()).toBe("80000");

    const porDebajo = planMonthlyCharges({
      ...base,
      members: [socio({ ownDuesAmount: new Prisma.Decimal("1000") })],
    });
    // El aporte es libre hacia arriba, no hacia abajo.
    expect(porDebajo.charges[0]?.amountArs.toString()).toBe("47000");
  });

  it("quien se asoció después del período no debe esa cuota", () => {
    const r = planMonthlyCharges({
      ...base,
      members: [socio({ joinedAt: new Date(Date.UTC(2026, 9, 5)) })],
    });
    expect(r.charges).toHaveLength(0);
    expect(r.skipped[0]?.reason).toBe("todavía no era socio");
  });

  it("quien entró antes del vencimiento paga ese mes", () => {
    const r = planMonthlyCharges({
      ...base,
      members: [socio({ joinedAt: new Date(Date.UTC(2026, 8, 3)) })],
    });
    expect(r.charges).toHaveLength(1);
  });

  it("quien entró después del vencimiento no paga ese mes", () => {
    // Cobrarle sería cobrarle por días en los que no era socio.
    const r = planMonthlyCharges({
      ...base,
      members: [socio({ joinedAt: new Date(Date.UTC(2026, 8, 25)) })],
    });
    expect(r.charges).toHaveLength(0);
    expect(r.skipped[0]?.reason).toBe("todavía no era socio");
  });

  it("con la regla desactivada, el mes de ingreso nunca se cobra", () => {
    const r = planMonthlyCharges({
      ...base,
      countJoinMonthIfBeforeDueDay: false,
      members: [socio({ joinedAt: new Date(Date.UTC(2026, 8, 3)) })],
    });
    expect(r.charges).toHaveLength(0);
  });

  it("sin valor de cuota vigente no inventa un importe", () => {
    const r = planMonthlyCharges({ ...base, members: [socio({ referenceAmount: null })] });
    expect(r.charges).toHaveLength(0);
    expect(r.skipped[0]?.reason).toBe("sin valor de cuota vigente");
  });

  it("el vencimiento nunca cae fuera del mes", () => {
    const r = planMonthlyCharges({ ...base, period: "2026-02", dueDay: 28, members: [socio()] });
    expect(r.charges[0]?.dueDate.toISOString()).toBe("2026-02-28T00:00:00.000Z");
  });

  it("cada socio aparece una sola vez, en cargos o en salteados", () => {
    const padron = [
      socio({ id: "a" }),
      socio({ id: "b", status: "INACTIVE" }),
      socio({ id: "c", feeScale: "EXENTA" }),
      socio({ id: "d", referenceAmount: null }),
    ];
    const r = planMonthlyCharges({ ...base, members: padron });
    const vistos = [...r.charges.map((c) => c.memberId), ...r.skipped.map((s) => s.memberId)];
    expect(vistos.sort()).toEqual(["a", "b", "c", "d"]);
    expect(new Set(vistos).size).toBe(4);
  });
});

describe("periodOf", () => {
  it("devuelve el mes en UTC", () => {
    expect(periodOf(new Date("2026-09-05T23:30:00.000Z"))).toBe("2026-09");
    expect(periodOf(new Date(Date.UTC(2026, 0, 1)))).toBe("2026-01");
  });
});
