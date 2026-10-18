import assert from "node:assert/strict";
import test from "node:test";

import { decide, type EntryLite } from "./decide";
import type { ParsedDoc } from "./readers";

const D = (s: string) => new Date(`${s}T12:00:00Z`);

function doc(p: Partial<ParsedDoc>): ParsedDoc {
  return {
    kind: "RECIBO",
    amount: 20,
    currency: "USD",
    invoiceNumber: "INV-1",
    docDate: D("2026-09-22"),
    paidAt: D("2026-09-22"),
    periodYear: 2026,
    periodMonth: 9,
    refunded: null,
    vendorKey: null,
    ...p,
  };
}

function entry(p: Partial<EntryLite>): EntryLite {
  return {
    id: 1,
    periodYear: 2026,
    periodMonth: 9,
    amountOriginal: 20,
    currency: "USD",
    status: "FACTURADO",
    source: "MAIL",
    invoiceNumber: "INV-1",
    notes: null,
    amountRefunded: null,
    paidAt: null,
    ...p,
  };
}

test("un recibo sin gasto previo crea un gasto pagado", () => {
  assert.deepEqual(decide(doc({}), []), {
    type: "create",
    entry: {
      periodYear: 2026,
      periodMonth: 9,
      amount: 20,
      currency: "USD",
      status: "PAGADO",
      invoiceNumber: "INV-1",
      paidAt: D("2026-09-22"),
      amountRefunded: null,
    },
  });
});

test("sin importe no se crea nada: queda para revisar", () => {
  const r = decide(doc({ kind: "PAGO_OK", amount: null, invoiceNumber: "IN-9" }), []);
  assert.equal(r.type, "review");
});

test("un pago encuentra su factura por número aunque sea de otro mes", () => {
  const r = decide(
    doc({ kind: "PAGO_OK", amount: 106.72, invoiceNumber: "2810533809", periodMonth: 8, paidAt: D("2026-10-18") }),
    [entry({ id: 5, periodMonth: 8, amountOriginal: 106.72, invoiceNumber: "2810533809", status: "RECHAZADO" })],
  );
  assert.deepEqual(r, { type: "update", entryId: 5, changes: { status: "PAGADO", paidAt: D("2026-10-18") } });
});

test("el número de factura también se busca en las notas de un gasto importado", () => {
  const r = decide(
    doc({ kind: "PAGO_FALLIDO", amount: 202.21, invoiceNumber: "SWURZY-00007", periodMonth: 8, paidAt: null }),
    [entry({ id: 7, periodMonth: 8, amountOriginal: 202.21, invoiceNumber: null, source: "IMPORTADO", status: "RECHAZADO", notes: "Factura SWURZY-00007. Computo 166,54" })],
  );
  assert.deepEqual(r, { type: "update", entryId: 7, changes: { invoiceNumber: "SWURZY-00007" } });
});

test("un estado nunca retrocede: un pago fallido viejo no deshace un pago", () => {
  const r = decide(doc({ kind: "PAGO_FALLIDO", amount: null, paidAt: null }), [entry({ status: "PAGADO", paidAt: D("2026-09-23") })]);
  assert.deepEqual(r, { type: "update", entryId: 1, changes: {} });
});

test("un gasto importado con el mismo mes e importe se completa en vez de duplicarse", () => {
  const r = decide(doc({ invoiceNumber: "VTFIW2NT-0001", periodMonth: 7 }), [
    entry({ id: 3, periodMonth: 7, invoiceNumber: null, source: "IMPORTADO", status: "PAGADO" }),
  ]);
  assert.deepEqual(r, { type: "update", entryId: 3, changes: { invoiceNumber: "VTFIW2NT-0001", paidAt: D("2026-09-22") } });
});

test("si un gasto cargado a mano para ese mes tiene otro importe, el mail va a revisar", () => {
  const r = decide(doc({ amount: 20, invoiceNumber: "TGAUGGOE-0001", periodMonth: 1 }), [
    entry({ id: 9, periodMonth: 1, amountOriginal: 17.46, invoiceNumber: null, source: "IMPORTADO", status: "PAGADO" }),
  ]);
  assert.equal(r.type, "review");
  assert.match(r.type === "review" ? r.reason : "", /17\.46/);
});

test("otra moneda en el mismo mes también va a revisar (no se comparan pesos con dólares)", () => {
  const r = decide(doc({ amount: 41.03, invoiceNumber: "IN-80185912", kind: "FACTURA", paidAt: null }), [
    entry({ id: 16, amountOriginal: 59197, currency: "ARS", invoiceNumber: null, source: "MANUAL", status: "PAGADO" }),
  ]);
  assert.equal(r.type, "review");
});

test("dos facturas distintas del mismo proveedor en el mismo mes conviven", () => {
  const r = decide(doc({ invoiceNumber: "INV-2", amount: 83.09 }), [entry({ invoiceNumber: "INV-1", status: "PAGADO" })]);
  assert.equal(r.type, "create");
});

test("un reembolso sobre una factura conocida suma lo devuelto", () => {
  const r = decide(doc({ kind: "REEMBOLSO", amount: 20, refunded: 4.27, paidAt: null }), [entry({ status: "PAGADO" })]);
  assert.deepEqual(r, { type: "update", entryId: 1, changes: { amountRefunded: 4.27 } });
});

test("un reembolso sin factura previa crea el gasto pagado con lo devuelto", () => {
  const r = decide(doc({ kind: "REEMBOLSO", amount: 60, refunded: 45.76, paidAt: null, invoiceNumber: "TGAUGGOE-0002" }), []);
  assert.equal(r.type, "create");
  assert.deepEqual(r.type === "create" && [r.entry.status, r.entry.amountRefunded], ["PAGADO", 45.76]);
});

test("un reembolso total deja el gasto como reembolsado", () => {
  const r = decide(doc({ kind: "REEMBOLSO", amount: 20, refunded: 20, paidAt: null }), []);
  assert.equal(r.type === "create" && r.entry.status, "REEMBOLSADO");
});

test("una compra confirmada sin factura paga la factura impaga del mismo importe", () => {
  const r = decide(doc({ kind: "PAGO_OK", amount: 41.03, invoiceNumber: null, periodMonth: 10, paidAt: D("2026-09-30") }), [
    entry({ id: 20, periodMonth: 9, amountOriginal: 41.03, invoiceNumber: "IN-80185912", status: "RECHAZADO" }),
  ]);
  assert.deepEqual(r, { type: "update", entryId: 20, changes: { status: "PAGADO", paidAt: D("2026-09-30") } });
});

test("la factura que llega después de la compra confirmada completa ese gasto", () => {
  const r = decide(doc({ kind: "FACTURA", amount: 45.39, invoiceNumber: "IN-7", periodMonth: 7, paidAt: null }), [
    entry({ id: 30, periodMonth: 7, amountOriginal: 45.39, invoiceNumber: null, status: "PAGADO", source: "MAIL" }),
  ]);
  assert.deepEqual(r, { type: "update", entryId: 30, changes: { invoiceNumber: "IN-7" } });
});

test("el estimado del período se crea una sola vez y se actualiza con el último valor", () => {
  const est = doc({ kind: "ESTIMADO", amount: 37.4, invoiceNumber: null, periodMonth: 10, paidAt: null });
  assert.equal(decide(est, []).type, "create");
  const r = decide(est, [entry({ id: 40, periodMonth: 10, amountOriginal: 25, invoiceNumber: null, status: "ESTIMADO" })]);
  assert.deepEqual(r, { type: "update", entryId: 40, changes: { amountOriginal: 37.4 } });
});

test("un estimado no se carga si el período ya tiene un gasto real", () => {
  const r = decide(doc({ kind: "ESTIMADO", amount: 37.4, invoiceNumber: null, paidAt: null }), [entry({ invoiceNumber: "IN-1", status: "FACTURADO" })]);
  assert.equal(r.type, "ignore");
});

test("la factura real reemplaza al estimado del mismo período", () => {
  const r = decide(doc({ kind: "FACTURA", amount: 41.03, invoiceNumber: "IN-80185912", paidAt: null }), [
    entry({ id: 41, amountOriginal: 37.4, invoiceNumber: null, status: "ESTIMADO" }),
  ]);
  assert.deepEqual(r, { type: "update", entryId: 41, changes: { status: "FACTURADO", invoiceNumber: "IN-80185912", amountOriginal: 41.03 } });
});

test("un gasto MANUAL con su número de factura pero otro importe no se pisa", () => {
  const r = decide(doc({ amount: 25 }), [entry({ source: "MANUAL", amountOriginal: 20, status: "FACTURADO" })]);
  assert.equal(r.type, "review");
});

test("C1: un pago sin factura paga la factura pendiente aunque haya un estimado en su mes", () => {
  const r = decide(doc({ kind: "PAGO_OK", amount: 41.03, invoiceNumber: null, periodMonth: 10, paidAt: D("2026-10-02") }), [
    entry({ id: 50, periodMonth: 9, amountOriginal: 41.03, invoiceNumber: "IN-80185912", status: "FACTURADO" }),
    entry({ id: 51, periodMonth: 10, amountOriginal: 37.4, invoiceNumber: null, status: "ESTIMADO" }),
  ]);
  assert.deepEqual(r, { type: "update", entryId: 50, changes: { status: "PAGADO", paidAt: D("2026-10-02") } });
});

test("C1: un pago sin factura y sin factura pendiente no toca el estimado", () => {
  const r = decide(doc({ kind: "PAGO_OK", amount: 41.03, invoiceNumber: null, periodMonth: 10, paidAt: D("2026-10-02") }), [
    entry({ id: 51, periodMonth: 10, amountOriginal: 37.4, invoiceNumber: null, status: "ESTIMADO" }),
  ]);
  assert.notEqual(r.type === "update" && r.entryId, 51);
});
