import assert from "node:assert/strict";
import test from "node:test";

import type { EntryChanges, EntryLite, NewEntry } from "./decide";
import { processMessages, type MessageUpdate, type PendingMail, type ProcessPorts } from "./process";

const NOW = new Date("2026-10-18T12:00:00Z");

function receipt(id: number, extra: Partial<PendingMail> = {}): PendingMail {
  return {
    id,
    vendorKey: "resend",
    fromAddress: "Resend <invoice+statements@invoicing.resend.com>",
    subject: "Your receipt from Resend #2438-9103",
    bodyText: "Receipt from Resend $20.00 Paid September 22, 2026 Receipt number 2438-9103 Invoice number VTFIW2NT-0002 Total $20.00 Amount paid $20.00",
    receivedAt: new Date("2026-09-22T20:00:00Z"),
    alertedAt: null,
    ...extra,
  };
}

function fakes(opts: { fx?: number | null; vendors?: Record<string, EntryLite[]> } = {}) {
  const vendors = new Map(Object.entries(opts.vendors ?? { resend: [], neon: [], "anthropic-api": [], anthropic: [] }));
  const created: { vendorKey: string; entry: NewEntry; fx: number | null }[] = [];
  const updated: { entryId: number; changes: EntryChanges }[] = [];
  const marks = new Map<number, MessageUpdate>();
  const notified: string[] = [];
  let nextId = 100;
  const ports: ProcessPorts = {
    async loadVendor(key) {
      const entries = vendors.get(key);
      return entries ? { id: 1, entries } : null;
    },
    async fxFor() {
      return opts.fx === undefined ? 1500 : opts.fx;
    },
    async createEntry(vendor, entry, fx) {
      const id = nextId++;
      created.push({ vendorKey: [...vendors.entries()].find(([, v]) => v === vendor.entries)?.[0] ?? "?", entry, fx });
      vendor.entries.push({
        id,
        periodYear: entry.periodYear,
        periodMonth: entry.periodMonth,
        amountOriginal: entry.amount,
        currency: entry.currency,
        status: entry.status,
        source: "MAIL",
        invoiceNumber: entry.invoiceNumber,
        notes: null,
        amountRefunded: entry.amountRefunded,
        paidAt: entry.paidAt,
      });
      return id;
    },
    async updateEntry(entryId, changes) {
      updated.push({ entryId, changes });
    },
    async markMessage(id, data) {
      marks.set(id, data);
    },
    async notify(text) {
      notified.push(text);
      return true;
    },
  };
  return { ports, created, updated, marks, notified };
}

test("un recibo se carga como gasto y el mail queda cargado", async () => {
  const f = fakes();
  const r = await processMessages([receipt(1)], f.ports, NOW);
  assert.deepEqual(r, { loaded: 1, review: 0, ignored: 0 });
  assert.equal(f.created[0].entry.invoiceNumber, "VTFIW2NT-0002");
  assert.equal(f.created[0].fx, 1500);
  const m = f.marks.get(1);
  assert.equal(m?.status, "CARGADO");
  assert.equal(m?.entryId, 100);
  assert.equal(m?.kind, "RECIBO");
});

test("el mismo mail procesado dos veces no duplica el gasto", async () => {
  const f = fakes();
  await processMessages([receipt(1)], f.ports, NOW);
  await processMessages([receipt(1)], f.ports, NOW);
  assert.equal(f.created.length, 1);
});

test("un formato desconocido queda para revisar con el motivo", async () => {
  const f = fakes();
  await processMessages([receipt(2, { bodyText: "Gracias por tu compra" })], f.ports, NOW);
  assert.equal(f.marks.get(2)?.status, "PARA_REVISAR");
  assert.match(f.marks.get(2)?.reviewReason ?? "", /formato/);
});

test("un aviso que no es cobro se descarta solo", async () => {
  const f = fakes();
  await processMessages([receipt(3, { vendorKey: "capcut", fromAddress: "CapCut <no-reply@account.capcut.com>", subject: "CapCut" })], f.ports, NOW);
  assert.equal(f.marks.get(3)?.status, "DESCARTADO");
  assert.match(f.marks.get(3)?.reviewReason ?? "", /^Automático:/);
});

test("sin cotización del dólar no se carga: queda para reintentar", async () => {
  const f = fakes({ fx: null });
  await processMessages([receipt(4)], f.ports, NOW);
  assert.equal(f.created.length, 0);
  assert.equal(f.marks.get(4)?.status, "PARA_REVISAR");
  assert.match(f.marks.get(4)?.reviewReason ?? "", /dólar/);
});

test("un pago fallido reciente avisa por Telegram una sola vez", async () => {
  const f = fakes();
  const fallo = receipt(5, {
    vendorKey: "neon",
    fromAddress: '"Neon, LLC" <noreply@ar.neon.tech>',
    subject: "Payment failed for Neon, LLC invoice (#SWURZY-00008)",
    bodyText: "su pago para la factura n.º SWURZY-00008 (127,31 $).",
    receivedAt: new Date("2026-10-15T00:00:00Z"),
  });
  await processMessages([fallo], f.ports, NOW);
  assert.equal(f.notified.length, 1);
  assert.match(f.notified[0], /SWURZY-00008/);
  assert.ok(f.marks.get(5)?.alertedAt);
  await processMessages([{ ...fallo, alertedAt: NOW }], f.ports, NOW);
  assert.equal(f.notified.length, 1);
});

test("un pago fallido viejo (del historial) no avisa", async () => {
  const f = fakes();
  await processMessages(
    [
      receipt(6, {
        vendorKey: "neon",
        fromAddress: '"Neon, LLC" <noreply@ar.neon.tech>',
        subject: "Payment failed for Neon, LLC invoice (#SWURZY-00003)",
        bodyText: "factura n.º SWURZY-00003 (38,40 $).",
        receivedAt: new Date("2026-04-02T00:00:00Z"),
      }),
    ],
    f.ports,
    NOW,
  );
  assert.equal(f.notified.length, 0);
});

test("si el contenido revela otro proveedor (Anthropic API), se carga a ese", async () => {
  const f = fakes();
  await processMessages(
    [
      receipt(7, {
        vendorKey: "anthropic",
        fromAddress: "invoice+statements@mail.anthropic.com",
        subject: "Your receipt from Anthropic, PBC #1",
        bodyText: "Receipt from Anthropic, PBC $50.00 Paid October 2, 2026 Invoice number API-0001 Anthropic API credits Total $50.00 Amount paid $50.00",
      }),
    ],
    f.ports,
    NOW,
  );
  assert.equal(f.created[0].vendorKey, "anthropic-api");
});

test("un proveedor que no existe en Finanzas deja el mail para revisar", async () => {
  const f = fakes({ vendors: {} });
  await processMessages([receipt(8)], f.ports, NOW);
  assert.match(f.marks.get(8)?.reviewReason ?? "", /no existe/);
});
