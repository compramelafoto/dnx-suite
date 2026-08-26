import { describe, expect, it } from "vitest";
import { outcomeForProviderStatus, shouldApply } from "./payment-outcome";

describe("outcomeForProviderStatus", () => {
  it("un pago aprobado se acredita", () => {
    expect(outcomeForProviderStatus("approved")).toBe("ACREDITAR");
  });

  it("efectivo pendiente espera: congela el plazo, no lo consume", () => {
    expect(outcomeForProviderStatus("pending")).toBe("ESPERAR");
    expect(outcomeForProviderStatus("in_process")).toBe("ESPERAR");
  });

  it("una tarjeta autorizada pero no capturada NO se acredita", () => {
    // Hay promesa de plata, no plata. Acreditarla dejaría al socio al día con dinero que
    // puede no llegar nunca.
    expect(outcomeForProviderStatus("authorized")).toBe("ESPERAR");
  });

  it("una devolución o un contracargo revierten", () => {
    expect(outcomeForProviderStatus("refunded")).toBe("REVERTIR");
    expect(outcomeForProviderStatus("charged_back")).toBe("REVERTIR");
  });

  it("rechazado y cancelado no acreditan nada", () => {
    expect(outcomeForProviderStatus("rejected")).toBe("RECHAZAR");
    expect(outcomeForProviderStatus("cancelled")).toBe("RECHAZAR");
  });

  it("un estado desconocido espera, nunca acredita", () => {
    expect(outcomeForProviderStatus("lo_que_sea")).toBe("ESPERAR");
    expect(outcomeForProviderStatus("")).toBe("ESPERAR");
  });
});

describe("shouldApply", () => {
  it("el aviso repetido de un pago ya acreditado no se vuelve a aplicar", () => {
    expect(shouldApply({ current: "ACREDITADO", outcome: "ACREDITAR" })).toBe(false);
  });

  it("un pago pendiente se acredita cuando llega el aviso", () => {
    expect(shouldApply({ current: "PENDIENTE", outcome: "ACREDITAR" })).toBe(true);
  });

  it("un contracargo sobre un pago acreditado sí se aplica", () => {
    expect(shouldApply({ current: "ACREDITADO", outcome: "REVERTIR" })).toBe(true);
  });

  it("un contracargo sobre algo que nunca se acreditó no hace nada", () => {
    expect(shouldApply({ current: "PENDIENTE", outcome: "REVERTIR" })).toBe(false);
    expect(shouldApply({ current: "RECHAZADO", outcome: "REVERTIR" })).toBe(false);
  });

  it("un rechazo llegado tarde no desacredita un pago bueno", () => {
    // MercadoPago manda avisos desordenados: un 'rejected' viejo detrás de un 'approved'
    // no puede dar de baja una acreditación correcta.
    expect(shouldApply({ current: "ACREDITADO", outcome: "RECHAZAR" })).toBe(false);
  });

  it("esperar nunca cambia nada", () => {
    for (const current of ["PENDIENTE", "ACREDITADO", "RECHAZADO"] as const) {
      expect(shouldApply({ current, outcome: "ESPERAR" })).toBe(false);
    }
  });
});
