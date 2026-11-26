import { describe, expect, it } from "vitest";
import { isRenewalReminderDue, nextRenewalAnniversary } from "./recordatorio";

const dia = (x: Date) => x.toISOString().slice(0, 10);

// Mediodía UTC = mismo día calendario en Argentina.
const d = (s: string) => new Date(`${s}T12:00:00.000Z`);

describe("nextRenewalAnniversary", () => {
  it("renovación 10/01/2024, hoy 11/12/2026 → 10/01/2027", () => {
    expect(dia(nextRenewalAnniversary(d("2024-01-10"), d("2026-12-11")))).toBe("2027-01-10");
  });
  it("29 de febrero en año común → 28 de febrero", () => {
    expect(dia(nextRenewalAnniversary(d("2024-02-29"), d("2027-01-29")))).toBe("2027-02-28");
  });
  it("29 de febrero en año bisiesto se conserva", () => {
    expect(dia(nextRenewalAnniversary(d("2024-02-29"), d("2027-12-30")))).toBe("2028-02-29");
  });
});

describe("isRenewalReminderDue", () => {
  it("avisa exactamente 30 días antes del aniversario", () => {
    expect(isRenewalReminderDue(d("2025-12-15"), d("2026-11-15"), null)).toBe(true);
  });
  it("no avisa 29 ni 31 días antes", () => {
    expect(isRenewalReminderDue(d("2025-12-15"), d("2026-11-16"), null)).toBe(false);
    expect(isRenewalReminderDue(d("2025-12-15"), d("2026-11-14"), null)).toBe(false);
  });
  it("cruza el fin de año: renovación el 10 de enero se avisa el 11 de diciembre", () => {
    expect(isRenewalReminderDue(d("2024-01-10"), d("2026-12-11"), null)).toBe(true);
    expect(isRenewalReminderDue(d("2024-01-10"), d("2026-12-12"), null)).toBe(false);
  });
  it("29 de febrero: en año bisiesto avisa 30 días antes del 29", () => {
    expect(isRenewalReminderDue(d("2024-02-29"), d("2028-01-30"), null)).toBe(true);
  });
  it("29 de febrero: en año común el aniversario es el 28", () => {
    expect(isRenewalReminderDue(d("2024-02-29"), d("2027-01-29"), null)).toBe(true);
    expect(isRenewalReminderDue(d("2024-02-29"), d("2027-01-30"), null)).toBe(false);
  });
  it("respeta lastSent: nulo o hace más de 300 días sí; hace menos, no", () => {
    const now = d("2026-11-15");
    expect(isRenewalReminderDue(d("2025-12-15"), now, d("2026-01-01"))).toBe(true); // 318 días
    expect(isRenewalReminderDue(d("2025-12-15"), now, d("2026-02-01"))).toBe(false); // 287 días
  });
  it("usa el día de Argentina, no el de UTC", () => {
    // 2026-11-16 01:00 UTC todavía es 15/11 a las 22:00 en Argentina.
    expect(isRenewalReminderDue(d("2025-12-15"), new Date("2026-11-16T01:00:00.000Z"), null)).toBe(
      true,
    );
  });
});
