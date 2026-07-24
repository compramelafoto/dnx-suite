/**
 * Gates Etapa 23 — Production OFF por defecto.
 * pnpm --filter @repo/db exec tsx ../../apps/infospot/lib/notifications/feature-flags.test.ts
 */
import assert from "node:assert/strict";
import {
  getNotificationsFlagsSnapshot,
  isNotificationCampaignsEnabled,
  isNotificationCronEnabled,
  isNotificationEmailChannelEnabled,
  isNotificationsEngineEnabled,
} from "./feature-flags";

{
  const env = { nodeEnv: "production", vercelEnv: "production" };
  assert.equal(isNotificationsEngineEnabled(env), false);
  assert.equal(isNotificationCampaignsEnabled(env), false);
  assert.equal(isNotificationCronEnabled(env), false);
  assert.equal(isNotificationEmailChannelEnabled(env), false);
}

{
  const env = {
    nodeEnv: "production",
    vercelEnv: "production",
    enabled: "1",
    campaigns: "1",
    cron: "0",
    email: "0",
  };
  assert.equal(isNotificationsEngineEnabled(env), true);
  assert.equal(isNotificationCampaignsEnabled(env), true);
  assert.equal(isNotificationCronEnabled(env), false);
  assert.equal(isNotificationEmailChannelEnabled(env), false);
}

{
  // Preview: ON aunque NODE_ENV=production
  const env = { nodeEnv: "production", vercelEnv: "preview" };
  assert.equal(isNotificationsEngineEnabled(env), true);
  assert.equal(isNotificationCronEnabled(env), true);
}

{
  const env = { nodeEnv: "production", vercelEnv: "preview", enabled: "0" };
  assert.equal(isNotificationsEngineEnabled(env), false);
  assert.equal(isNotificationCampaignsEnabled(env), false);
}

{
  const env = { nodeEnv: "development", vercelEnv: null };
  const snap = getNotificationsFlagsSnapshot(env);
  assert.equal(snap.productionRuntime, false);
  assert.equal(snap.engine, true);
  assert.equal(snap.campaigns, true);
  assert.equal(snap.cron, true);
  assert.equal(snap.email, true);
}

console.log("feature-flags.test.ts: OK");
