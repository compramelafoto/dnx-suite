import { describe, expect, it } from "vitest";
import {
  cobrosQueDevengan,
  comisionPropia,
  descargaDeDeuda,
  inicioDelMesArgentino,
  leerRetencionDelPago,
  metadatosDeRetencion,
  notaDevengado,
  notaReverso,
  notaRetenido,
  porcentaje,
  retencionParaPago,
} from "./comision";

describe("comisión de un cobro", () => {
  it("es monto × bps / 10000, redondeada a la mitad hacia arriba, en centavos", () => {
    expect(comisionPropia(3_000_000, 500)).toBe(150_000);
    expect(comisionPropia(1_010, 500)).toBe(51); // 50,5 → 51
    expect(comisionPropia(1_009, 500)).toBe(50);
  });
  it("con 0 bps (DNX) o un monto inválido no hay comisión", () => {
    expect(comisionPropia(3_000_000, 0)).toBe(0);
    expect(comisionPropia(-100, 500)).toBe(0);
    expect(comisionPropia(10.5, 500)).toBe(0);
  });
});

describe("qué cobros devengan", () => {
  const c = (id: string, extra: Partial<{ voidedAt: Date | null; amountMinor: number }> = {}) => ({ id, voidedAt: null, amountMinor: 1_000_000, ...extra });
  it("los vigentes sin comisión marcada, con su monto a devengar", () => {
    const r = cobrosQueDevengan([c("a"), c("b"), c("c", { voidedAt: new Date() })], new Set(["b"]), 500);
    expect(r).toEqual([{ id: "a", comisionMinor: 50_000 }]);
  });
  it("nada con 0 bps, ni los que darían 0 centavos", () => {
    expect(cobrosQueDevengan([c("a")], new Set(), 0)).toEqual([]);
    expect(cobrosQueDevengan([c("a", { amountMinor: 9 })], new Set(), 500)).toEqual([]);
  });
});

describe("retención en un pago de Mercado Pago", () => {
  it("la propia más toda la deuda que entre", () => {
    expect(retencionParaPago({ paymentMinor: 1_000_000, bps: 500, pendingDebtMinor: 20_000 })).toEqual({ propioMinor: 50_000, retenidoMinor: 70_000 });
  });
  it("nunca llega al total del pago: Mercado Pago rechaza una comisión igual al importe", () => {
    expect(retencionParaPago({ paymentMinor: 100_000, bps: 500, pendingDebtMinor: 10_000_000 })).toEqual({ propioMinor: 5_000, retenidoMinor: 99_999 });
  });
  it("con 0 bps no retiene nada (ni la deuda: DNX es la plataforma)", () => {
    expect(retencionParaPago({ paymentMinor: 1_000_000, bps: 0, pendingDebtMinor: 20_000 })).toBeNull();
  });
  it("metadatos de la preferencia: texto (el adaptador sólo acepta texto)", () => {
    expect(metadatosDeRetencion({ propioMinor: 50_000, retenidoMinor: 70_000 })).toEqual({ fo_comision_propia_minor: "50000", fo_retencion_minor: "70000" });
  });
});

describe("lo que Mercado Pago dice que retuvo", () => {
  it("la retención es el application_fee de fee_details; la propia sale de los metadatos", () => {
    const raw = {
      fee_details: [{ type: "mercadopago_fee", amount: 300 }, { type: "application_fee", amount: 700 }],
      platform_fee_metadata: { own_minor: "50000", withheld_minor: "70000" },
    };
    expect(leerRetencionDelPago(raw, 1_000_000, 500)).toEqual({ retenidoMinor: 70_000, propioMinor: 50_000 });
  });
  it("sin application_fee usa la retención de los metadatos", () => {
    expect(leerRetencionDelPago({ fee_details: [], platform_fee_metadata: { own_minor: "50000", withheld_minor: "70000" } }, 1_000_000, 500)).toEqual({ retenidoMinor: 70_000, propioMinor: 50_000 });
  });
  it("sin metadatos, la propia se recalcula con la tasa de hoy y nunca supera lo retenido", () => {
    expect(leerRetencionDelPago({ fee_details: [{ type: "application_fee", amount: 700 }] }, 1_000_000, 500)).toEqual({ retenidoMinor: 70_000, propioMinor: 50_000 });
    expect(leerRetencionDelPago({ fee_details: [{ type: "application_fee", amount: 100 }] }, 1_000_000, 500)).toEqual({ retenidoMinor: 10_000, propioMinor: 10_000 });
  });
  it("sin retención (pago abierto antes de la entrega): null", () => {
    expect(leerRetencionDelPago({ fee_details: [{ type: "mercadopago_fee", amount: 300 }] }, 1_000_000, 500)).toBeNull();
    expect(leerRetencionDelPago({}, 1_000_000, 500)).toBeNull();
    expect(leerRetencionDelPago({ fee_details: [{ type: "application_fee", amount: "x" }], platform_fee_metadata: { own_minor: "abc" } }, 1_000_000, 500)).toBeNull();
  });
});

describe("descarga de deuda al acreditar", () => {
  it("retenido − propio, acotado a la deuda del momento", () => {
    expect(descargaDeDeuda({ retenidoMinor: 70_000, propioMinor: 50_000, deudaMinor: 100_000 })).toBe(20_000);
    expect(descargaDeDeuda({ retenidoMinor: 70_000, propioMinor: 50_000, deudaMinor: 5_000 })).toBe(5_000);
    expect(descargaDeDeuda({ retenidoMinor: 50_000, propioMinor: 50_000, deudaMinor: 5_000 })).toBe(0);
    expect(descargaDeDeuda({ retenidoMinor: 40_000, propioMinor: 50_000, deudaMinor: 5_000 })).toBe(0);
  });
});

describe("notas del libro", () => {
  it("dicen el porcentaje, el pedido y el recibo, en pesos", () => {
    expect(porcentaje(500)).toBe("5 %");
    expect(porcentaje(250)).toBe("2,5 %");
    expect(notaDevengado({ bps: 500, pedidoNumero: "2026-0001", recibo: "R-0007", comisionMinor: 150_000 })).toBe("Comisión 5 % · pedido 2026-0001 · recibo R-0007 · 1.500 pesos");
    expect(notaRetenido({ bps: 500, pedidoNumero: "2026-0001", recibo: "R-0007", retenidoMinor: 70_000, propioMinor: 50_000, descargaMinor: 20_000 })).toBe(
      "Comisión 5 % retenida por Mercado Pago · pedido 2026-0001 · recibo R-0007 · 700 pesos (500 pesos de este cobro y 200 pesos de deuda)",
    );
    expect(notaReverso({ pedidoNumero: "2026-0001", recibo: "R-0007" })).toBe("Cobro anulado: se revierte la comisión devengada · pedido 2026-0001 · recibo R-0007");
  });
});

describe("mes en curso", () => {
  it("empieza a las 0 h de Argentina (3 h UTC) del día 1", () => {
    expect(inicioDelMesArgentino(new Date("2026-10-22T15:00:00Z")).toISOString()).toBe("2026-10-01T03:00:00.000Z");
    // 1/11 a la 1 de la mañana UTC todavía es 31/10 en Argentina.
    expect(inicioDelMesArgentino(new Date("2026-11-01T01:00:00Z")).toISOString()).toBe("2026-10-01T03:00:00.000Z");
  });
});
