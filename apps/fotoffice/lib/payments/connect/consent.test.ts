import { describe, expect, it } from "vitest";
import { canChargeWithSplit, normalizeConsentStatus } from "./consent";

describe("normalizeConsentStatus", () => {
  it.each([
    ["ACTIVE", "ACTIVE"],
    ["active", "ACTIVE"],
    ["PENDING", "PENDING"],
    ["pending", "PENDING"],
    ["REJECTED", "REJECTED"],
    ["CANCELED", "CANCELED"],
    ["EXPIRED", "EXPIRED"],
  ])("%s se normaliza a %s", (raw, expected) => {
    expect(normalizeConsentStatus(raw)).toBe(expected);
  });

  it("sin dato es NONE", () => {
    expect(normalizeConsentStatus(null)).toBe("NONE");
    expect(normalizeConsentStatus(undefined)).toBe("NONE");
    expect(normalizeConsentStatus("")).toBe("NONE");
  });

  /**
   * Si MercadoPago devuelve un estado que no conocemos, nunca se interpreta como activo:
   * dar por bueno un consentimiento que no entendemos termina en un cobro rechazado.
   */
  it("un estado desconocido queda pendiente, nunca activo", () => {
    expect(normalizeConsentStatus("LO_QUE_SEA")).toBe("PENDING");
    expect(normalizeConsentStatus("ACTIVO")).toBe("PENDING");
  });

  it("ignora espacios alrededor", () => {
    expect(normalizeConsentStatus("  active  ")).toBe("ACTIVE");
  });
});

describe("canChargeWithSplit", () => {
  it("solo con consentimiento activo se puede cobrar", () => {
    expect(canChargeWithSplit("ACTIVE")).toBe(true);
  });

  it.each(["NONE", "PENDING", "REJECTED", "CANCELED", "EXPIRED"] as const)(
    "con %s no se puede cobrar",
    (state) => {
      expect(canChargeWithSplit(state)).toBe(false);
    },
  );
});
