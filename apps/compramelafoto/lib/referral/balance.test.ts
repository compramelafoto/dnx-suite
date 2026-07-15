/**
 * pnpm --filter @repo/db exec tsx ../../apps/compramelafoto/lib/referral/balance.test.ts
 */

import assert from "node:assert/strict";
import {
  MIN_PAYOUT_PESOS,
  availableEarningWhere,
  evaluatePayoutEligibility,
} from "./balance-rules";

{
  assert.equal(MIN_PAYOUT_PESOS, 1);
  assert.equal(availableEarningWhere.paidOutAt, null);
  assert.equal(availableEarningWhere.reversedAt, null);
  assert.equal(availableEarningWhere.appliedAt, null);
}

{
  const noCbu = evaluatePayoutEligibility({
    balancePesos: 100,
    hasPending: false,
    cbu: "",
    cbuTitular: "Titular",
  });
  assert.equal(noCbu.ok, false);
  if (!noCbu.ok) assert.equal(noCbu.status, 400);
}

{
  const pending = evaluatePayoutEligibility({
    balancePesos: 100,
    hasPending: true,
    cbu: "0000003100010000000001",
    cbuTitular: "Titular",
  });
  assert.equal(pending.ok, false);
  if (!pending.ok) assert.equal(pending.status, 409);
}

{
  const low = evaluatePayoutEligibility({
    balancePesos: 0,
    hasPending: false,
    cbu: "alias.mp",
    cbuTitular: "Titular",
  });
  assert.equal(low.ok, false);
  if (!low.ok) assert.equal(low.status, 400);
}

{
  const ok = evaluatePayoutEligibility({
    balancePesos: 250.5,
    hasPending: false,
    cbu: "alias.mp",
    cbuTitular: "Titular Smoke",
  });
  assert.equal(ok.ok, true);
  if (ok.ok) assert.equal(ok.balancePesos, 250.5);
}

console.log("referral balance.test.ts OK");
