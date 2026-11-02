import { describe, expect, it } from "vitest";
import { evaluateAccreditationEligibility } from "./elegibilidad";

const base = { estadoPago: "PAGADO", alreadyCheckedIn: false, accreditationEnabled: true, grantException: false };

describe("evaluateAccreditationEligibility", () => {
  it("pagado y con la acreditación encendida: verde", () => {
    expect(evaluateAccreditationEligibility(base)).toMatchObject({ tone: "GREEN", canCheckIn: true });
  });
  it("cortesía cuenta como pagado", () => {
    expect(evaluateAccreditationEligibility({ ...base, estadoPago: "CORTESIA" }).canCheckIn).toBe(true);
  });
  it("anulado: rojo aunque ya hubiera entrado", () => {
    expect(evaluateAccreditationEligibility({ ...base, estadoPago: "ANULADO", alreadyCheckedIn: true })).toMatchObject({
      tone: "RED",
      reason: "REGISTRATION_INACTIVE",
    });
  });
  it("ya acreditado: azul y no deja acreditar de nuevo", () => {
    expect(evaluateAccreditationEligibility({ ...base, alreadyCheckedIn: true })).toMatchObject({ tone: "BLUE", canCheckIn: false });
  });
  it("con la acreditación apagada no deja pasar a nadie", () => {
    expect(evaluateAccreditationEligibility({ ...base, accreditationEnabled: false, grantException: true })).toMatchObject({
      reason: "ACCREDITATION_DISABLED",
      canCheckIn: false,
    });
  });
  it("pago pendiente: sólo con excepción", () => {
    expect(evaluateAccreditationEligibility({ ...base, estadoPago: "PENDIENTE" })).toMatchObject({ reason: "PAYMENT_PENDING", canCheckIn: false });
    expect(evaluateAccreditationEligibility({ ...base, estadoPago: "PENDIENTE", grantException: true }).canCheckIn).toBe(true);
  });
});
