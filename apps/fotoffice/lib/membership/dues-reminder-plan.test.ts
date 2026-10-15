import { describe, expect, it } from "vitest";
import { planReminder, reminderWindowOpen, type ChargeForReminder } from "./dues-reminder-plan";

const octubre = { period: "2026-10", dueDate: new Date(Date.UTC(2026, 9, 10)) };

function cargo(parcial: Partial<ChargeForReminder>): ChargeForReminder {
  return {
    period: "2026-10",
    concept: "MENSUAL",
    dueDate: new Date(Date.UTC(2026, 9, 10)),
    balanceMinor: 800000,
    ...parcial,
  };
}

describe("planReminder", () => {
  it("al que no debe nada no se le escribe", () => {
    expect(planReminder({ ...octubre, charges: [cargo({ balanceMinor: 0 })] })).toBeNull();
  });

  it("la cuota del mes va como cuota del mes", () => {
    const plan = planReminder({ ...octubre, charges: [cargo({})] });
    expect(plan?.current?.period).toBe("2026-10");
    expect(plan?.overdue).toEqual([]);
  });

  it("lo atrasado va aparte, de lo más viejo a lo más nuevo", () => {
    const plan = planReminder({
      ...octubre,
      charges: [
        cargo({}),
        cargo({ period: "2026-09", dueDate: new Date(Date.UTC(2026, 8, 10)) }),
        cargo({ period: "2026-08", dueDate: new Date(Date.UTC(2026, 7, 10)) }),
      ],
    });
    expect(plan?.overdue.map((c) => c.period)).toEqual(["2026-08", "2026-09"]);
  });

  it("si pagó el mes pero debe septiembre, igual se le recuerda", () => {
    const plan = planReminder({
      ...octubre,
      charges: [cargo({ period: "2026-09", dueDate: new Date(Date.UTC(2026, 8, 10)) })],
    });
    expect(plan?.current).toBeNull();
    expect(plan?.overdue).toHaveLength(1);
  });

  it("la deuda de apertura no se reclama", () => {
    const plan = planReminder({
      ...octubre,
      charges: [cargo({ period: "APERTURA", concept: "OTRO", dueDate: new Date(Date.UTC(2026, 7, 31)) })],
    });
    expect(plan).toBeNull();
  });

  it("lo que vence después del mes en curso no se reclama", () => {
    const plan = planReminder({
      ...octubre,
      charges: [cargo({ period: "2026-11", concept: "INGRESO", dueDate: new Date(Date.UTC(2026, 10, 10)) })],
    });
    expect(plan).toBeNull();
  });
});

describe("reminderWindowOpen", () => {
  it("abre el día configurado y los dos siguientes", () => {
    expect(reminderWindowOpen({ today: 4, reminderDay: 5 })).toBe(false);
    expect(reminderWindowOpen({ today: 5, reminderDay: 5 })).toBe(true);
    expect(reminderWindowOpen({ today: 7, reminderDay: 5 })).toBe(true);
    expect(reminderWindowOpen({ today: 8, reminderDay: 5 })).toBe(false);
  });
});
