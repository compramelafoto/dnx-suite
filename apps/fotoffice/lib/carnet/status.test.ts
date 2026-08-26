import { describe, expect, it } from "vitest";
import { computeCardStatus, explainDisabled, type CardFacts } from "./status";
import { computeDelinquency } from "./delinquency";

const ahora = new Date("2026-08-26T12:00:00.000Z");
const enDosAnios = new Date("2028-08-26T12:00:00.000Z");
const alDia = computeDelinquency([]);

function facts(over: Partial<CardFacts> = {}): CardFacts {
  return {
    memberStatus: "ACTIVE",
    revokedAt: null,
    validUntil: enDosAnios,
    delinquency: alDia,
    now: ahora,
    ...over,
  };
}

describe("computeCardStatus", () => {
  it("socio activo, carnet vigente y al día: habilitado", () => {
    const r = computeCardStatus(facts());
    expect(r.enabled).toBe(true);
    expect(r.reason).toBe(null);
  });

  it("un carnet vencido no habilita", () => {
    const r = computeCardStatus(facts({ validUntil: new Date("2026-08-01T00:00:00.000Z") }));
    expect(r.enabled).toBe(false);
    expect(r.reason).toBe("CARD_EXPIRED");
    expect(r.expired).toBe(true);
  });

  it("un carnet revocado no habilita", () => {
    const r = computeCardStatus(facts({ revokedAt: new Date("2026-08-20T00:00:00.000Z") }));
    expect(r.enabled).toBe(false);
    expect(r.reason).toBe("CARD_REVOKED");
    expect(r.revoked).toBe(true);
  });

  it("una revocación con fecha futura todavía no revoca", () => {
    const r = computeCardStatus(facts({ revokedAt: new Date("2027-01-01T00:00:00.000Z") }));
    expect(r.revoked).toBe(false);
    expect(r.enabled).toBe(true);
  });

  it("un socio suspendido no habilita aunque el carnet esté impecable", () => {
    const r = computeCardStatus(facts({ memberStatus: "SUSPENDED" }));
    expect(r.enabled).toBe(false);
    expect(r.reason).toBe("SUSPENDED");
  });

  it("la mora inhabilita sin tocar la condición institucional", () => {
    const enMora = computeDelinquency([
      { concept: "MENSUAL", period: "2026-06", balanceMinor: 100 },
      { concept: "MENSUAL", period: "2026-07", balanceMinor: 100 },
      { concept: "MENSUAL", period: "2026-08", balanceMinor: 100 },
    ]);
    const r = computeCardStatus(facts({ delinquency: enMora }));
    expect(r.enabled).toBe(false);
    expect(r.reason).toBe("DELINQUENT");
  });

  it("dejar de ser socio manda sobre el resto de los motivos", () => {
    // A quien ya no es socio no tiene sentido decirle que su carnet venció.
    const r = computeCardStatus({
      ...facts({ memberStatus: "INACTIVE" }),
      validUntil: new Date("2020-01-01T00:00:00.000Z"),
      revokedAt: new Date("2020-01-01T00:00:00.000Z"),
    });
    expect(r.reason).toBe("NOT_A_MEMBER");
  });

  it("justo en el instante del vencimiento, ya no habilita", () => {
    const r = computeCardStatus(facts({ validUntil: ahora }));
    expect(r.enabled).toBe(false);
  });

  it("pagar vuelve a habilitar sin que nadie actualice nada", () => {
    // Es el pedido de que se actualice en tiempo real: no hay estado guardado que
    // sincronizar, así que la próxima consulta ya devuelve habilitado.
    const enMora = computeDelinquency([
      { concept: "MENSUAL", period: "2026-06", balanceMinor: 100 },
      { concept: "MENSUAL", period: "2026-07", balanceMinor: 100 },
      { concept: "MENSUAL", period: "2026-08", balanceMinor: 100 },
    ]);
    expect(computeCardStatus(facts({ delinquency: enMora })).enabled).toBe(false);

    const despuesDePagar = computeDelinquency([
      { concept: "MENSUAL", period: "2026-06", balanceMinor: 0 },
      { concept: "MENSUAL", period: "2026-07", balanceMinor: 0 },
      { concept: "MENSUAL", period: "2026-08", balanceMinor: 0 },
    ]);
    expect(computeCardStatus(facts({ delinquency: despuesDePagar })).enabled).toBe(true);
  });
});

describe("explainDisabled", () => {
  it("todos los motivos tienen un texto para una persona", () => {
    for (const motivo of ["NOT_A_MEMBER", "SUSPENDED", "CARD_REVOKED", "CARD_EXPIRED", "DELINQUENT"] as const) {
      const texto = explainDisabled(motivo);
      expect(texto.length).toBeGreaterThan(20);
      expect(texto).not.toMatch(/[A-Z_]{4,}/); // sin nombres técnicos
    }
  });
});
