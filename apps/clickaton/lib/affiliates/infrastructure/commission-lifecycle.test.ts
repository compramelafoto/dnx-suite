import assert from "node:assert/strict";
import test from "node:test";

import {
  reverseAffiliateCommission,
  settleAffiliateCommissionOnPaid,
  type AffiliateCommissionDb,
} from "./commission-lifecycle";

type Row = {
  id: string;
  registrationId: string;
  status: string;
  mode: string | null;
  paidAt: Date | null;
  paidOutAt: Date | null;
  reversedAt: Date | null;
  reversalReason: string | null;
};

function fakeDb(rows: Row[], opts?: { throwOnRead?: boolean }) {
  const db = {
    clickatonAffiliateCommission: {
      async findUnique(args: { where: { registrationId: string } }) {
        if (opts?.throwOnRead) throw new Error('relation "ClickatonAffiliateCommission" does not exist');
        return rows.find((r) => r.registrationId === args.where.registrationId) ?? null;
      },
      async updateMany(args: { where: { id: string; status: string }; data: Partial<Row> }) {
        const row = rows.find((r) => r.id === args.where.id && r.status === args.where.status);
        if (!row) return { count: 0 };
        Object.assign(row, args.data);
        return { count: 1 };
      },
    },
  };
  return db as unknown as AffiliateCommissionDb;
}

function row(overrides: Partial<Row> = {}): Row {
  return {
    id: "c1",
    registrationId: "r1",
    status: "PENDING",
    mode: null,
    paidAt: null,
    paidOutAt: null,
    reversedAt: null,
    reversalReason: null,
    ...overrides,
  };
}

const NOW = new Date("2026-10-01T12:00:00Z");

test("al cobrar sin split queda OWED/MANUAL con la fecha del cobro", async () => {
  const rows = [row()];
  const out = await settleAffiliateCommissionOnPaid(fakeDb(rows), "r1", NOW);
  assert.deepEqual(out, { applied: true, status: "OWED" });
  assert.equal(rows[0]!.mode, "MANUAL");
  assert.equal(rows[0]!.paidAt, NOW);
});

test("al cobrar con split marcado queda PAID_BY_SPLIT", async () => {
  const rows = [row({ mode: "SPLIT" })];
  const out = await settleAffiliateCommissionOnPaid(fakeDb(rows), "r1", NOW);
  assert.deepEqual(out, { applied: true, status: "PAID_BY_SPLIT" });
});

test("sin comisión no hace nada", async () => {
  const out = await settleAffiliateCommissionOnPaid(fakeDb([]), "r1", NOW);
  assert.deepEqual(out, { applied: false, reason: "no_commission" });
});

test("tabla ausente: no tira", async () => {
  const out = await reverseAffiliateCommission(fakeDb([], { throwOnRead: true }), "r1", "x", NOW);
  assert.deepEqual(out, { applied: false, reason: "error" });
});

test("reversa de una transferida: conserva paidOutAt y avisa", async () => {
  const paidOutAt = new Date("2026-09-20T00:00:00Z");
  const rows = [row({ status: "PAID_OUT", mode: "MANUAL", paidOutAt })];
  const out = await reverseAffiliateCommission(fakeDb(rows), "r1", "pago reembolsado", NOW);
  assert.deepEqual(out, { applied: true, status: "REVERSED" });
  assert.equal(rows[0]!.paidOutAt, paidOutAt);
  assert.equal(rows[0]!.reversedAt, NOW);
  assert.match(rows[0]!.reversalReason ?? "", /posterior a la transferencia/);
});

test("una segunda reversa no cambia nada", async () => {
  const rows = [row({ status: "REVERSED", reversalReason: "primera" })];
  const out = await reverseAffiliateCommission(fakeDb(rows), "r1", "segunda", NOW);
  assert.deepEqual(out, { applied: false, reason: "no_change" });
  assert.equal(rows[0]!.reversalReason, "primera");
});
