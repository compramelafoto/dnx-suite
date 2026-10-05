import { describe, expect, it } from "vitest";
import { collectionDate, isFullyReversed, parseMpPayment } from "./payment-facts";

describe("parseMpPayment", () => {
  it("separa la comisión de Mercado Pago de la de la plataforma", () => {
    const f = parseMpPayment({
      id: 123,
      status: "approved",
      external_reference: "booking:abc",
      transaction_amount: 10000,
      date_approved: "2026-10-01T22:10:29.000-03:00",
      fee_details: [
        { type: "mercadopago_fee", amount: 650.5, fee_payer: "collector" },
        { type: "application_fee", amount: 500, fee_payer: "collector" },
      ],
    });
    expect(f.id).toBe("123");
    expect(f.grossMinor).toBe(1_000_000);
    expect(f.mpFeeMinor).toBe(65_050);
    expect(f.platformFeeMinor).toBe(50_000);
    expect(f.feeSource).toBe("fee_details");
    expect(f.approvedAt?.toISOString()).toBe("2026-10-02T01:10:29.000Z");
  });

  it("no descuenta lo que paga el comprador (recargo por cuotas)", () => {
    const f = parseMpPayment({
      transaction_amount: 10000,
      fee_details: [
        { type: "mercadopago_fee", amount: 600, fee_payer: "collector" },
        { type: "financing_fee", amount: 1500, fee_payer: "payer" },
      ],
    });
    expect(f.mpFeeMinor).toBe(60_000);
    expect(f.platformFeeMinor).toBe(0);
  });

  it("sin filas, usa el neto recibido y separa el marketplace_fee", () => {
    const f = parseMpPayment({
      transaction_amount: 10000,
      marketplace_fee: 500,
      transaction_details: { net_received_amount: 8850 },
    });
    expect(f.feeSource).toBe("net_received");
    expect(f.platformFeeMinor).toBe(50_000);
    expect(f.mpFeeMinor).toBe(65_000);
  });

  it("sin datos de comisión no inventa nada", () => {
    const f = parseMpPayment({ transaction_amount: 10000 });
    expect(f.feeSource).toBe("unknown");
    expect(f.mpFeeMinor + f.platformFeeMinor).toBe(0);
  });

  it("lee lo devuelto", () => {
    const f = parseMpPayment({ status: "approved", transaction_amount: 100, transaction_amount_refunded: 40 });
    expect(f.refundedMinor).toBe(4_000);
    expect(isFullyReversed(f)).toBe(false);
  });
});

describe("isFullyReversed", () => {
  it("devolución total y contracargo", () => {
    expect(isFullyReversed(parseMpPayment({ status: "refunded" }))).toBe(true);
    expect(isFullyReversed(parseMpPayment({ status: "charged_back" }))).toBe(true);
    expect(isFullyReversed(parseMpPayment({ status: "approved" }))).toBe(false);
  });
});

describe("collectionDate", () => {
  it("prefiere la fecha de aprobación y si no la hay usa el respaldo", () => {
    const respaldo = new Date("2026-10-05T12:00:00Z");
    expect(collectionDate(parseMpPayment({}), respaldo)).toBe(respaldo);
    expect(collectionDate(parseMpPayment({ date_approved: "2026-10-01T10:00:00Z" }), respaldo).toISOString()).toBe(
      "2026-10-01T10:00:00.000Z",
    );
  });
});
