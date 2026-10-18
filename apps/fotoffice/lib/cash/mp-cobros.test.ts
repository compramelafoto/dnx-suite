import { describe, expect, it } from "vitest";
import { aCobroMp, consultaCobros } from "./mp-cobros";

describe("consultaCobros", () => {
  it("pide el rango por fecha de creación, del más nuevo al más viejo", () => {
    const q = consultaCobros(new Date("2026-10-18T03:00:00Z"), new Date("2026-10-19T03:00:00Z"), "555");
    expect(q).toMatchObject({
      "collector.id": "555",
      range: "date_created",
      begin_date: "2026-10-18T03:00:00.000Z",
      end_date: "2026-10-19T03:00:00.000Z",
      sort: "date_created",
      criteria: "desc",
    });
  });
});

describe("aCobroMp", () => {
  it("una transferencia recibida", () => {
    const c = aCobroMp({
      id: 123,
      transaction_amount: 102,
      status: "approved",
      payment_type_id: "bank_transfer",
      date_created: "2026-10-18T10:40:00.000-03:00",
      date_approved: "2026-10-18T10:40:05.000-03:00",
      payer: { first_name: "Daniel", last_name: "Cuart" },
      collector_id: 555,
    }, "555");
    expect(c).toMatchObject({ id: "123", montoMinor: 10_200, estado: "approved", medio: "Transferencia", pagador: "Daniel Cuart" });
    expect(c?.fecha?.toISOString()).toBe("2026-10-18T13:40:05.000Z");
  });

  it("sin nombre usa el correo; sin tipo conocido, money_transfer es transferencia", () => {
    const c = aCobroMp({ id: "9", transaction_amount: 101.5, operation_type: "money_transfer", payer: { email: "a@b.com" } }, "555");
    expect(c).toMatchObject({ montoMinor: 10_150, medio: "Transferencia", pagador: "a@b.com" });
  });

  it("un resultado sin monto se descarta", () => {
    expect(aCobroMp({ id: 1 }, "555")).toBeNull();
  });

  it("lo que pagó el negocio (otro cobrador, como las cuotas de Mercado Crédito) no es un cobro", () => {
    const pagoPropio = { id: 7, transaction_amount: 92056.96, status: "approved", collector_id: 999, description: "Pago de cuotas de Mercado Crédito" };
    expect(aCobroMp(pagoPropio, "555")).toBeNull();
    expect(aCobroMp({ ...pagoPropio, collector_id: undefined, collector: { id: 999 } }, "555")).toBeNull();
  });
});
