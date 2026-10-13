import { describe, expect, it } from "vitest";
import {
  isAbandonedRenewal,
  isRenewalPeriod,
  renewalPeriodFor,
  withSimpleFormDefaults,
} from "./enrollment";

describe("alta sin aprobación y renovación sin deuda", () => {
  it("el período de una renovación es único por momento y en hora argentina", () => {
    // 13/10 a las 18:30:45 UTC son las 15:30:45 en Rosario.
    expect(renewalPeriodFor(new Date("2026-10-13T18:30:45Z"))).toBe("RENOV-20261013-153045");
    expect(isRenewalPeriod("RENOV-20261013-153045")).toBe(true);
    expect(isRenewalPeriod("2026-10")).toBe(false);
  });

  it("el formulario corto completa lo que el completo exige por estatuto", () => {
    const r = withSimpleFormDefaults({ firstName: "Juan", lastName: "Pérez", email: "j@x.com" });
    expect(r.noticeAddress).toMatch(/No corresponde/);
    expect(r.declaredFeeScale).toBe("PLENA");
    expect(r.firstName).toBe("Juan");
  });

  it("una renovación sin pagar se borra pasado el plazo; una pagada o reciente, no", () => {
    const base = {
      period: "RENOV-20261013-153045",
      amountMinor: 6_000_000,
      balanceMinor: 6_000_000,
      createdAt: new Date("2026-10-13T18:00:00Z"),
      hasAllocations: false,
      graceHours: 72,
    };
    expect(isAbandonedRenewal({ ...base, now: new Date("2026-10-17T18:00:00Z") })).toBe(true);
    expect(isAbandonedRenewal({ ...base, now: new Date("2026-10-14T18:00:00Z") })).toBe(false);
    expect(isAbandonedRenewal({ ...base, hasAllocations: true, now: new Date("2026-10-20T18:00:00Z") })).toBe(false);
    expect(isAbandonedRenewal({ ...base, period: "2026-10", now: new Date("2026-10-20T18:00:00Z") })).toBe(false);
  });
});
