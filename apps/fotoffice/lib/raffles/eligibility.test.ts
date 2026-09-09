import { describe, expect, it } from "vitest";
import { isEligible, selectEntrants, type MemberForRaffle } from "./eligibility";

const CIERRE = new Date("2026-09-29T23:00:00Z");

const socio = (extra: Partial<MemberForRaffle> = {}): MemberForRaffle => ({
  memberId: "m-1",
  memberNumber: "0100",
  fullName: "Ana Díaz",
  status: "ACTIVE",
  charges: [],
  ...extra,
});

const cargo = (period: string, dias: number, saldo: number) => ({
  period,
  dueDate: new Date(CIERRE.getTime() + dias * 86_400_000),
  balanceMinor: saldo,
});

describe("quién participa", () => {
  it("el socio activo y sin deuda vencida participa", () => {
    expect(isEligible(socio(), CIERRE)).toEqual({ eligible: true, reason: null });
  });

  it("el socio con una cuota vencida impaga no participa, y se dice cuál", () => {
    const r = isEligible(socio({ charges: [cargo("2026-08", -10, 5_000_00)] }), CIERRE);
    expect(r.eligible).toBe(false);
    expect(r.reason).toContain("agosto de 2026");
  });

  it("una cuota que todavía no venció no lo deja afuera", () => {
    expect(isEligible(socio({ charges: [cargo("2026-10", 5, 5_000_00)] }), CIERRE).eligible).toBe(true);
  });

  it("una cuota vencida pero ya pagada no lo deja afuera", () => {
    expect(isEligible(socio({ charges: [cargo("2026-08", -10, 0)] }), CIERRE).eligible).toBe(true);
  });

  it("la deuda de apertura NO lo deja afuera: la institución todavía no puede justificarla", () => {
    expect(isEligible(socio({ charges: [cargo("APERTURA", -300, 60_000_00)] }), CIERRE).eligible).toBe(
      true,
    );
  });

  it("apertura impaga y además una cuota mensual vencida: no participa, y el motivo es la cuota", () => {
    const r = isEligible(
      socio({ charges: [cargo("APERTURA", -300, 60_000_00), cargo("2026-07", -40, 5_000_00)] }),
      CIERRE,
    );
    expect(r.eligible).toBe(false);
    expect(r.reason).toContain("julio de 2026");
    expect(r.reason).not.toContain("APERTURA");
  });

  it("el socio suspendido no participa", () => {
    const r = isEligible(socio({ status: "SUSPENDED" }), CIERRE);
    expect(r.eligible).toBe(false);
    expect(r.reason).toMatch(/no está activa/i);
  });

  it("el socio dado de baja no participa", () => {
    expect(isEligible(socio({ status: "INACTIVE" }), CIERRE).eligible).toBe(false);
  });

  it("el motivo nombra la cuota más vieja cuando hay varias", () => {
    const r = isEligible(
      socio({ charges: [cargo("2026-08", -10, 5_000_00), cargo("2026-06", -70, 5_000_00)] }),
      CIERRE,
    );
    expect(r.reason).toContain("junio de 2026");
  });

  it("el carnet impreso impago vencido también lo deja afuera", () => {
    const r = isEligible(socio({ charges: [cargo("TARJETA", -30, 8_000_00)] }), CIERRE);
    expect(r.eligible).toBe(false);
    expect(r.reason).toContain("Carnet impreso");
  });

  it("el motivo nunca le muestra al socio un período crudo", () => {
    const r = isEligible(socio({ charges: [cargo("2026-08", -10, 5_000_00)] }), CIERRE);
    expect(r.reason).not.toContain("2026-08");
  });

  it("se mide contra el cierre del padrón, no contra hoy: una cuota que vence DESPUÉS del cierre no bloquea", () => {
    const r = isEligible(socio({ charges: [cargo("2026-10", 1, 5_000_00)] }), CIERRE);
    expect(r.eligible).toBe(true);
  });
});

describe("armar el padrón", () => {
  it("deja sólo a los que participan, con los datos que necesita la huella", () => {
    const padron = selectEntrants(
      [
        socio(),
        socio({ memberId: "m-2", memberNumber: "0101", charges: [cargo("2026-08", -10, 5_000_00)] }),
        socio({ memberId: "m-3", memberNumber: "0102", fullName: "Beto Ruiz" }),
      ],
      CIERRE,
    );
    expect(padron.map((e) => e.memberId)).toEqual(["m-1", "m-3"]);
    expect(padron[1]).toEqual({ memberId: "m-3", memberNumber: "0102", fullName: "Beto Ruiz" });
  });

  it("si nadie está al día, el padrón queda vacío y eso lo resuelve quien llama", () => {
    expect(selectEntrants([socio({ status: "INACTIVE" })], CIERRE)).toEqual([]);
  });
});
