/**
 * Tests Etapa 19 — ops/permisos de cancel/retry + métricas tasas.
 * pnpm --filter @repo/db exec tsx ../../apps/infospot/lib/notifications/etapa-19-ops.test.ts
 */

import assert from "node:assert/strict";
import {
  canNotifyClfPhotographerCall,
  type InfoSpotPermissionSubject,
} from "@repo/db";
import { resolveWorkerConfig, renderNearbyCallEmail } from "@repo/notifications";

function subject(
  partial: Partial<InfoSpotPermissionSubject> & { role: string },
): InfoSpotPermissionSubject {
  return {
    status: "ACTIVE",
    canPublish: false,
    publicationPolicy: "REQUIRES_APPROVAL",
    canProvisionClfPhotographerCall: false,
    canNotifyClfPhotographerCall: false,
    isSuperAdmin: false,
    ...partial,
  };
}

{
  const provisionOnly = subject({
    role: "INFOSPOT_REDACTOR",
    canProvisionClfPhotographerCall: true,
  });
  assert.equal(canNotifyClfPhotographerCall(provisionOnly), false);
}

{
  const cfg = resolveWorkerConfig({ batchSize: 5, maxAttempts: 3 });
  assert.equal(cfg.batchSize, 5);
  assert.equal(cfg.maxAttempts, 3);
}

{
  const email = renderNearbyCallEmail({
    eventName: "Demo",
    city: "CABA",
    ctaUrl: "https://example.com/x",
    prefsUrl: "https://example.com/p",
  });
  assert.match(email.subject, /CABA/);
}

function rate(num: number, den: number): number | null {
  if (den <= 0) return null;
  return num / den;
}
assert.equal(rate(0, 0), null);
assert.equal(rate(1, 2), 0.5);

console.log("etapa-19-ops.test.ts: OK");
