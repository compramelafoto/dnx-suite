import { describe, expect, it } from "vitest";
import type { MpPaymentFacts } from "@/lib/payments/mp/payment-facts";
import { validarVenta, type VentaParaValidar } from "./validacion";

const VENTA: VentaParaValidar = { clfOrderId: 5978, pagoFamiliaArs: 20000, retenidoEsperadoArs: 2609, estadoClf: "PAID", cobradorMpUserId: "97484805" };

function facts(p: Partial<MpPaymentFacts> = {}): MpPaymentFacts {
  return {
    id: "188336783078",
    status: "approved",
    statusDetail: "accredited",
    externalReference: "5978",
    grossMinor: 2_000_000,
    mpFeeMinor: 120_000,
    platformFeeMinor: 260_900,
    refundedMinor: 0,
    approvedAt: new Date("2026-11-07T15:40:00Z"),
    lastUpdatedAt: new Date("2026-11-07T15:41:00Z"),
    paymentMethodId: "account_money",
    feeSource: "fee_details",
    ...p,
  };
}

describe("validarVenta", () => {
  it("todo coincide: validada, con el acreditado neto de las dos comisiones", () => {
    expect(validarVenta(VENTA, { ok: true, facts: facts() }, "97484805")).toEqual({
      validacion: "VALIDADA",
      mpBrutoArs: 20000,
      mpComisionPlataformaArs: 2609,
      mpComisionMpArs: 1200,
      mpAcreditadoArs: 16191,
      mpReintegradoArs: 0,
      reintegradoEl: null,
    });
  });

  it("la cuenta se cobra a sí misma y Mercado Pago no informa comisión de plataforma", () => {
    const r = validarVenta(VENTA, { ok: true, facts: facts({ platformFeeMinor: 0 }) }, "97484805");
    expect(r.validacion).toBe("VALIDADA_CUENTA_PROPIA");
  });

  it("sin comisión de plataforma y con otra cuenta: diferencia", () => {
    expect(validarVenta(VENTA, { ok: true, facts: facts({ platformFeeMinor: 0 }) }, "111").validacion).toBe("CON_DIFERENCIA");
  });

  it("comisión distinta de la esperada", () => {
    expect(validarVenta(VENTA, { ok: true, facts: facts({ platformFeeMinor: 200_000 }) }, "97484805").validacion).toBe("CON_DIFERENCIA");
  });

  it("$1 de redondeo se tolera", () => {
    expect(validarVenta(VENTA, { ok: true, facts: facts({ platformFeeMinor: 261_000 }) }, "97484805").validacion).toBe("VALIDADA");
  });

  it("external_reference de otro pedido", () => {
    expect(validarVenta(VENTA, { ok: true, facts: facts({ externalReference: "1" }) }, "97484805").validacion).toBe("CON_DIFERENCIA");
  });

  it("reintegro total y parcial", () => {
    const total = validarVenta(VENTA, { ok: true, facts: facts({ refundedMinor: 2_000_000, status: "refunded" }) }, "97484805");
    expect(total).toMatchObject({ validacion: "REINTEGRADA", mpReintegradoArs: 20000, reintegradoEl: new Date("2026-11-07T15:41:00Z") });
    const parcial = validarVenta(VENTA, { ok: true, facts: facts({ refundedMinor: 500_000 }) }, "97484805");
    expect(parcial).toMatchObject({ validacion: "REINTEGRO_PARCIAL", mpReintegradoArs: 5000 });
  });

  it("contracargo sin monto reintegrado informado: cuenta como reintegro total", () => {
    const r = validarVenta(VENTA, { ok: true, facts: facts({ status: "charged_back" }) }, "97484805");
    expect(r).toMatchObject({ validacion: "REINTEGRADA", mpReintegradoArs: 20000 });
  });

  it("no se puede leer el pago con la cuenta del espacio", () => {
    expect(validarVenta(VENTA, { ok: false, tipo: "NO_ACCESO" }, "97484805").validacion).toBe("NO_EN_TU_MP");
    expect(validarVenta(VENTA, { ok: false, tipo: "SIN_COBROS" }, null).validacion).toBe("NO_EN_TU_MP");
  });

  it("un pago en disputa no sale validado aunque los montos coincidan", () => {
    expect(validarVenta(VENTA, { ok: true, facts: facts({ status: "in_mediation" }) }, "97484805")).toMatchObject({ validacion: "CON_DIFERENCIA", mpAcreditadoArs: null });
  });

  it("CLF dice reintegrado y Mercado Pago no muestra devolución: diferencia", () => {
    expect(validarVenta({ ...VENTA, estadoClf: "REFUNDED" }, { ok: true, facts: facts() }, "97484805").validacion).toBe("CON_DIFERENCIA");
  });

  it("Mercado Pago caído: queda pendiente para reintentar", () => {
    expect(validarVenta(VENTA, { ok: false, tipo: "TEMPORAL" }, "97484805")).toEqual({ validacion: "PENDIENTE" });
  });
});
