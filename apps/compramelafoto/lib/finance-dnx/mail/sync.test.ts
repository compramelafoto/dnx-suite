import assert from "node:assert/strict";
import test from "node:test";

import { OAuthError } from "./google-oauth";
import { GmailError, type GmailMessage } from "./gmail";
import { LOOKBACK_DAYS, syncAccount, type NewMailMessage, type SyncAccount, type SyncPorts } from "./sync";

const NOW = new Date("2026-10-18T09:00:00Z");
const FAR = Date.now() + 60_000;

const CUENTA: SyncAccount = {
  id: 1, email: "compramelafoto@gmail.com", lastSyncAt: null, backfillDone: false, lastErrorAlertedAt: null,
};

function mensaje(id: string, from = "payment@aws.com"): GmailMessage {
  return { id, from, subject: "Gracias por el pago", receivedAt: NOW, bodyText: `cuerpo ${id}` };
}

function fakes(pages: string[][], known: string[] = [], opts: { failToken?: Error; telegramOk?: boolean } = {}) {
  const saved: NewMailMessage[] = [];
  const queries: string[] = [];
  const synced: { at: Date | null; backfillDone: boolean }[] = [];
  let tokenCalls = 0;
  const errors: { message: string; alertedAt: Date | null }[] = [];
  const notified: string[] = [];
  const store = new Set(known);
  const ports: SyncPorts = {
    async getAccessToken() {
      tokenCalls++;
      if (opts.failToken) throw opts.failToken;
      return "tok";
    },
    async listIds(_t, query, pageToken) {
      queries.push(query);
      const i = pageToken ? Number(pageToken) : 0;
      return { ids: pages[i] ?? [], nextPageToken: i + 1 < pages.length ? String(i + 1) : null };
    },
    async getMessage(_t, id) {
      if (id.startsWith("roto")) throw new Error("Gmail respondió 500: backend error");
      if (id.startsWith("auth")) throw new GmailError("Gmail respondió 401: Invalid Credentials", 401);
      if (id.startsWith("nul")) return { ...mensaje(id), subject: "Recibo\u0000", bodyText: "Total\u0000 20" };
      return id.startsWith("raro") ? mensaje(id, "alguien@otro.com") : mensaje(id);
    },
    async knownIds(ids) {
      return new Set(ids.filter((id) => store.has(id)));
    },
    async saveMessage(msg) {
      store.add(msg.gmailMessageId);
      saved.push(msg);
    },
    async markSynced(_id, at, backfillDone) {
      synced.push({ at, backfillDone });
    },
    async markError(_id, message, alertedAt) {
      errors.push({ message, alertedAt });
    },
    async notify(text) {
      notified.push(text);
      return opts.telegramOk ?? true;
    },
  };
  return { ports, saved, queries, synced, errors, notified, tokenCalls: () => tokenCalls };
}

test("la primera vez busca sin fecha, guarda todo y marca el historial como leído", async () => {
  const f = fakes([["a", "b"], ["c"]]);
  const r = await syncAccount(CUENTA, f.ports, { now: NOW, deadlineMs: FAR });
  assert.deepEqual(r, { email: CUENTA.email, saved: 3, pending: false, error: null });
  assert.equal(f.queries[0].includes("after:"), false);
  assert.deepEqual(f.synced, [{ at: NOW, backfillDone: true }]);
  assert.equal(f.saved[0].vendorKey, "aws");
  assert.match(f.saved[0].reviewReason, /lector/);
});

test("un mail ya guardado no se vuelve a guardar", async () => {
  const f = fakes([["a", "b", "c"]], ["b"]);
  const r = await syncAccount(CUENTA, f.ports, { now: NOW, deadlineMs: FAR });
  assert.equal(r.saved, 2);
  assert.deepEqual(f.saved.map((m) => m.gmailMessageId), ["a", "c"]);
});

test("un remitente desconocido se guarda sin proveedor y con el motivo", async () => {
  const f = fakes([["raro1"]]);
  await syncAccount(CUENTA, f.ports, { now: NOW, deadlineMs: FAR });
  assert.equal(f.saved[0].vendorKey, null);
  assert.match(f.saved[0].reviewReason, /ningún proveedor/);
});

test("con el historial leído, busca desde la última lectura menos 3 días", async () => {
  const last = new Date("2026-10-17T09:00:00Z");
  const f = fakes([[]]);
  await syncAccount({ ...CUENTA, lastSyncAt: last, backfillDone: true }, f.ports, { now: NOW, deadlineMs: FAR });
  const desde = Math.floor((last.getTime() - LOOKBACK_DAYS * 86_400_000) / 1000);
  assert.equal(f.queries[0].endsWith(`after:${desde}`), true);
});

test("si se corta por tope, queda pendiente y el historial no se marca como leído", async () => {
  const f = fakes([["a", "b", "c", "d"]]);
  const r = await syncAccount(CUENTA, f.ports, { now: NOW, deadlineMs: FAR, maxMessages: 2 });
  assert.equal(r.saved, 2);
  assert.equal(r.pending, true);
  assert.deepEqual(f.synced, [{ at: null, backfillDone: false }]);
});

test("si se acaba el tiempo, corta sin guardar más", async () => {
  const f = fakes([["a", "b"]]);
  const r = await syncAccount(CUENTA, f.ports, { now: NOW, deadlineMs: Date.now() - 1 });
  assert.equal(r.saved, 0);
  assert.equal(r.pending, true);
});

test("la siguiente ejecución sigue donde quedó", async () => {
  const f = fakes([["a", "b", "c", "d"]]);
  await syncAccount(CUENTA, f.ports, { now: NOW, deadlineMs: FAR, maxMessages: 2 });
  const r = await syncAccount(CUENTA, f.ports, { now: NOW, deadlineMs: FAR, maxMessages: 2 });
  assert.equal(r.saved, 2);
  const r3 = await syncAccount(CUENTA, f.ports, { now: NOW, deadlineMs: FAR, maxMessages: 2 });
  assert.deepEqual([r3.saved, r3.pending], [0, false]);
  assert.deepEqual(f.saved.map((m) => m.gmailMessageId), ["a", "b", "c", "d"]);
});

test("un permiso revocado se registra y avisa por Telegram una vez", async () => {
  const err = new OAuthError("Google revocó el permiso de lectura.", true);
  const f = fakes([[]], [], { failToken: err });
  const r = await syncAccount(CUENTA, f.ports, { now: NOW, deadlineMs: FAR });
  assert.match(r.error ?? "", /revocó/);
  assert.deepEqual(f.errors, [{ message: err.message, alertedAt: NOW }]);
  assert.equal(f.notified.length, 1);
  assert.match(f.notified[0], /compramelafoto@gmail.com/);
});

test("si ya se avisó ese error, no se vuelve a avisar", async () => {
  const f = fakes([[]], [], { failToken: new OAuthError("revocado", true) });
  const yaAvisado = new Date("2026-10-17T09:00:00Z");
  await syncAccount({ ...CUENTA, lastErrorAlertedAt: yaAvisado }, f.ports, { now: NOW, deadlineMs: FAR });
  assert.equal(f.notified.length, 0);
  assert.deepEqual(f.errors, [{ message: "revocado", alertedAt: yaAvisado }]);
});

test("una lectura reciente que se corta no adelanta la fecha: lo no leído entra la próxima vez", async () => {
  const last = new Date("2026-10-08T09:00:00Z");
  const f = fakes([["a", "b", "c"]]);
  const r = await syncAccount({ ...CUENTA, lastSyncAt: last, backfillDone: true }, f.ports, { now: NOW, deadlineMs: FAR, maxMessages: 1 });
  assert.equal(r.pending, true);
  assert.deepEqual(f.synced, [{ at: last, backfillDone: true }]);
});

test("si el tiempo ya se acabó antes de empezar, no llama a Google ni toca la cuenta", async () => {
  const f = fakes([["a"]]);
  const r = await syncAccount(CUENTA, f.ports, { now: NOW, deadlineMs: Date.now() - 1 });
  assert.deepEqual(r, { email: CUENTA.email, saved: 0, pending: true, error: null });
  assert.equal(f.tokenCalls(), 0);
  assert.deepEqual(f.synced, []);
});

test("si el aviso por Telegram falla, no se marca como avisado y se reintenta la próxima vez", async () => {
  const f = fakes([[]], [], { failToken: new OAuthError("revocado", true), telegramOk: false });
  await syncAccount(CUENTA, f.ports, { now: NOW, deadlineMs: FAR });
  assert.equal(f.notified.length, 1);
  assert.deepEqual(f.errors, [{ message: "revocado", alertedAt: null }]);
});

test("un mail que no se puede bajar no traba la cuenta: queda para revisar y sigue con el resto", async () => {
  const f = fakes([["a", "roto1", "b"]]);
  const r = await syncAccount(CUENTA, f.ports, { now: NOW, deadlineMs: FAR });
  assert.equal(r.error, null);
  assert.equal(r.saved, 3);
  const roto = f.saved.find((m) => m.gmailMessageId === "roto1");
  assert.equal(roto?.vendorKey, null);
  assert.match(roto?.reviewReason ?? "", /No se pudo leer/);
  assert.deepEqual(f.synced, [{ at: NOW, backfillDone: true }]);
});

test("un caracter nulo en el mail se limpia antes de guardar", async () => {
  const f = fakes([["nul1"]]);
  await syncAccount(CUENTA, f.ports, { now: NOW, deadlineMs: FAR });
  assert.equal(f.saved[0].subject, "Recibo");
  assert.equal(f.saved[0].bodyText, "Total 20");
});

test("un 401 de Gmail es un problema de la cuenta, no de un mail", async () => {
  const f = fakes([["auth1"]]);
  const r = await syncAccount(CUENTA, f.ports, { now: NOW, deadlineMs: FAR });
  assert.match(r.error ?? "", /401/);
  assert.equal(f.saved.length, 0);
});
