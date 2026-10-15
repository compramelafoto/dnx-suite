import assert from "node:assert/strict";
import test from "node:test";

import {
  AFFILIATE_SPLIT_FLAG,
  decideAffiliateSplit,
  isAffiliateSplitEnabled,
  type DecideAffiliateSplitInput,
} from "./affiliate-split";

const DNX_PA = "pa_ba733fa7a35f4326";

function input(overrides: Partial<DecideAffiliateSplitInput> = {}): DecideAffiliateSplitInput {
  return {
    flagEnabled: true,
    hasCardPayment: true,
    // $30.000 de lista, 10% de comisión, MP 6%: neto 282.000 centavos.
    commission: {
      affiliateId: "aff_1",
      status: "PENDING",
      mode: null,
      baseAmount: 3_000_000,
      commissionBps: 1000,
      mpFeeBps: 600,
      netAmount: 282_000,
    },
    receiver: { receiverId: "3f8a1c2e-4b5d-4e6f-8a9b-0c1d2e3f4a5b", recipientId: "rcp_1" },
    totalAmountMinor: 2_700_000,
    collector: { paymentAccountId: DNX_PA, expectedPaymentAccountId: DNX_PA },
    ...overrides,
  };
}

const env = (vars: Record<string, string>) => vars as unknown as NodeJS.ProcessEnv;

test("el interruptor está apagado por defecto", () => {
  assert.equal(isAffiliateSplitEnabled(env({})), false);
  assert.equal(isAffiliateSplitEnabled(env({ [AFFILIATE_SPLIT_FLAG]: "off" })), false);
  assert.equal(isAffiliateSplitEnabled(env({ [AFFILIATE_SPLIT_FLAG]: "true" })), true);
  assert.equal(isAffiliateSplitEnabled(env({ [AFFILIATE_SPLIT_FLAG]: " ON " })), true);
});

test("reparte el neto anotado cuando todo cierra", () => {
  assert.deepEqual(decideAffiliateSplit(input()), {
    split: {
      recipientId: "rcp_1",
      receiverId: "3f8a1c2e-4b5d-4e6f-8a9b-0c1d2e3f4a5b",
      partnerAmountMinor: 282_000,
    },
  });
});

test("ante cualquier duda no reparte (y dice por qué)", () => {
  const reason = (o: Partial<DecideAffiliateSplitInput>) => {
    const d = decideAffiliateSplit(input(o));
    return d.split === null ? d.reason : "split";
  };
  assert.equal(reason({ flagEnabled: false }), "flag_off");
  assert.equal(reason({ hasCardPayment: false }), "no_card");
  assert.equal(reason({ commission: null }), "no_commission");
  assert.equal(
    reason({ commission: { ...input().commission!, status: "OWED" } }),
    "commission_not_pending",
  );
  assert.equal(reason({ receiver: null }), "no_active_receiver");
  assert.equal(reason({ receiver: { receiverId: " ", recipientId: "rcp_1" } }), "no_active_receiver");
  assert.equal(
    reason({ collector: { paymentAccountId: "pa_otra", expectedPaymentAccountId: DNX_PA } }),
    "collector_not_dnx",
  );
  assert.equal(
    reason({ commission: { ...input().commission!, netAmount: 300_000 } }),
    "amount_changed",
  );
  // Código del 100%: no hay de dónde sacar la comisión.
  assert.equal(reason({ totalAmountMinor: 0 }), "not_splittable");
  assert.equal(reason({ totalAmountMinor: 282_000 }), "not_splittable");
});

test("sin dato de collector (pantalla de pago) no lo verifica", () => {
  const d = decideAffiliateSplit(input({ collector: undefined }));
  assert.notEqual(d.split, null);
});
