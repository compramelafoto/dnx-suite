import { describe, expect, it } from "vitest";
import {
  HISTORICAL_METHODS,
  historicalMethod,
  isHistoricalMethod,
  isHistoricalPayment,
  paymentMethodLabel,
} from "./payment-method";

describe("marca de pago histórico", () => {
  it("un pago cargado como histórico se reconoce como tal", () => {
    expect(isHistoricalPayment(historicalMethod("EFECTIVO"))).toBe(true);
  });

  it("los pagos que sí pasaron por el sistema no se confunden con históricos", () => {
    expect(isHistoricalPayment("EFECTIVO")).toBe(false);
    expect(isHistoricalPayment("TRANSFERENCIA")).toBe(false);
    expect(isHistoricalPayment(null)).toBe(false);
  });

  it("todos los medios históricos declarados son válidos y viceversa", () => {
    for (const m of HISTORICAL_METHODS) expect(isHistoricalMethod(m)).toBe(true);
    expect(isHistoricalMethod("BITCOIN")).toBe(false);
    expect(isHistoricalMethod("efectivo")).toBe(false);
  });
});

describe("paymentMethodLabel", () => {
  it("un pago sin medio pero con referencia del proveedor es de Mercado Pago", () => {
    expect(paymentMethodLabel({ method: null, hasProviderRef: true })).toBe("Mercado Pago");
  });

  it("sin medio y sin referencia no se inventa un medio", () => {
    expect(paymentMethodLabel({ method: null, hasProviderRef: false })).toBe("Sin especificar");
    expect(paymentMethodLabel({ method: "   ", hasProviderRef: false })).toBe("Sin especificar");
  });

  it("un histórico se muestra con el nombre de su medio real, sin el prefijo técnico", () => {
    expect(paymentMethodLabel({ method: historicalMethod("TRANSFERENCIA"), hasProviderRef: false }))
      .toBe("Transferencia");
    // El prefijo nunca puede llegar a la pantalla del socio.
    for (const m of HISTORICAL_METHODS) {
      expect(paymentMethodLabel({ method: historicalMethod(m), hasProviderRef: false }))
        .not.toContain("HIST");
    }
  });

  it("un medio desconocido se muestra tal cual en vez de desaparecer", () => {
    expect(paymentMethodLabel({ method: "DEBITO_AUTOMATICO", hasProviderRef: false }))
      .toBe("DEBITO_AUTOMATICO");
  });
});

describe("Mercado Pago histórico", () => {
  it("el pago que el sistema anterior cobró por Mercado Pago se muestra como tal", () => {
    // Etiquetarlo «otro medio» sería falso justo en el dato que el socio reconoce.
    expect(paymentMethodLabel({ method: historicalMethod("MERCADO_PAGO"), hasProviderRef: false }))
      .toBe("Mercado Pago");
    expect(isHistoricalMethod("MERCADO_PAGO")).toBe(true);
  });
});
