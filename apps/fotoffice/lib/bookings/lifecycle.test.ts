import { describe, expect, it } from "vitest";
import { canCancelByCustomer } from "./lifecycle";

const ahora = new Date("2026-09-19T12:00:00Z");
const en48h = new Date("2026-09-21T12:00:00Z");
const en2h = new Date("2026-09-19T14:00:00Z");

describe("hasta cuándo puede cancelar quien reservó", () => {
  it("con 48 horas por delante y una ventana de 24, puede", () => {
    expect(
      canCancelByCustomer({
        startAt: en48h,
        status: "CONFIRMED",
        cancelWindowHours: 24,
        now: ahora,
      }),
    ).toEqual({ ok: true });
  });

  it("con 2 horas por delante y una ventana de 24, ya no", () => {
    const r = canCancelByCustomer({
      startAt: en2h,
      status: "CONFIRMED",
      cancelWindowHours: 24,
      now: ahora,
    });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.motivo).toContain("24");
  });

  it("una ventana de cero deja cancelar hasta el momento de empezar", () => {
    expect(
      canCancelByCustomer({ startAt: en2h, status: "CONFIRMED", cancelWindowHours: 0, now: ahora }),
    ).toEqual({ ok: true });
  });

  it("una reserva ya empezada no se cancela", () => {
    const r = canCancelByCustomer({
      startAt: new Date("2026-09-19T11:00:00Z"),
      status: "CONFIRMED",
      cancelWindowHours: 0,
      now: ahora,
    });
    expect(r.ok).toBe(false);
  });

  it("una reserva ya cancelada o vencida no se vuelve a cancelar", () => {
    for (const status of ["CANCELLED", "EXPIRED"]) {
      const r = canCancelByCustomer({ startAt: en48h, status, cancelWindowHours: 24, now: ahora });
      expect(r.ok, status).toBe(false);
    }
  });

  it("una que está esperando el pago sí se puede soltar", () => {
    // Es lo que hace que el socio pueda arrepentirse sin esperar el vencimiento.
    expect(
      canCancelByCustomer({ startAt: en48h, status: "HOLD", cancelWindowHours: 24, now: ahora }),
    ).toEqual({ ok: true });
  });

  it("una que está a aprobar también, y no espera a que la institución decida", () => {
    expect(
      canCancelByCustomer({
        startAt: en48h,
        status: "PENDING_APPROVAL",
        cancelWindowHours: 24,
        now: ahora,
      }),
    ).toEqual({ ok: true });
  });
});
