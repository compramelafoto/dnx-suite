/**
 * Tests Etapa 20 — panel admin helpers, gates QA, contratos de preview/ops.
 * pnpm --filter infospot test:etapa-20
 */

import assert from "node:assert/strict";
import {
  canNotifyClfPhotographerCall,
  type InfoSpotPermissionSubject,
} from "@repo/db";
import { CAMPAIGN_STATUS_LABELS, type CampaignStatus } from "./campaign-admin";
import { QA_PREFIX, QA_TAG, anonymizeDbUrl } from "./qa-kit";

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
  const statuses = Object.keys(CAMPAIGN_STATUS_LABELS) as CampaignStatus[];
  assert.deepEqual(
    statuses.sort(),
    ["CANCELLED", "COMPLETED", "DRAFT", "FAILED", "PROCESSING", "QUEUED"].sort(),
  );
}

{
  assert.equal(QA_TAG, "QA_NOTIFICATIONS_ETAPA20");
  assert.match(QA_PREFIX, /QA NOTIFICATIONS/);
}

{
  const url = anonymizeDbUrl("postgresql://user:secret@host/db");
  assert.equal(url.includes("secret"), false);
  assert.match(url, /\*\*\*/);
}

{
  const provisionOnly = subject({
    role: "INFOSPOT_REDACTOR",
    canProvisionClfPhotographerCall: true,
  });
  assert.equal(canNotifyClfPhotographerCall(provisionOnly), false);

  const notifyEditor = subject({
    role: "INFOSPOT_REDACTOR",
    canNotifyClfPhotographerCall: true,
  });
  assert.equal(canNotifyClfPhotographerCall(notifyEditor), true);

  const director = subject({ role: "INFOSPOT_DIRECTOR" });
  assert.equal(canNotifyClfPhotographerCall(director), true);
}

{
  // Contrato UI: estados reales del enum (no READY/PARTIAL inventados).
  assert.equal(CAMPAIGN_STATUS_LABELS.QUEUED, "En cola");
  assert.equal(CAMPAIGN_STATUS_LABELS.COMPLETED, "Completada");
}

console.log("etapa-20-qa.test.ts: OK");
