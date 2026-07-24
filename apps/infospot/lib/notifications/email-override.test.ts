/**
 * Reglas de override EMAIL (Etapa 22).
 * pnpm --filter infospot exec tsx lib/notifications/email-override.test.ts
 */
import assert from "node:assert/strict";
import {
  isNotificationsProductionRuntime,
  resolveNotificationEmailTo,
} from "./email-override";

{
  const r = resolveNotificationEmailTo({
    recipientEmail: "real@example.com",
    nodeEnv: "production",
    vercelEnv: "production",
    override: "qa-override@example.com",
  });
  assert.equal(r.to, "real@example.com");
  assert.equal(r.overridden, false);
  assert.equal(r.ignoredOverrideInProduction, true);
}

{
  // Preview Vercel: NODE_ENV=production pero VERCEL_ENV=preview → override permitido
  const r = resolveNotificationEmailTo({
    recipientEmail: "real@example.com",
    nodeEnv: "production",
    vercelEnv: "preview",
    override: "qa-override@example.com",
  });
  assert.equal(r.to, "qa-override@example.com");
  assert.equal(r.overridden, true);
  assert.equal(r.ignoredOverrideInProduction, false);
}

{
  const r = resolveNotificationEmailTo({
    recipientEmail: "real@example.com",
    nodeEnv: "production",
    vercelEnv: null,
    override: "qa-override@example.com",
  });
  assert.equal(r.to, "real@example.com");
  assert.equal(r.overridden, false);
  assert.equal(r.ignoredOverrideInProduction, true);
}

{
  const r = resolveNotificationEmailTo({
    recipientEmail: "real@example.com",
    nodeEnv: "development",
    override: "qa-override@example.com",
  });
  assert.equal(r.to, "qa-override@example.com");
  assert.equal(r.overridden, true);
}

{
  const r = resolveNotificationEmailTo({
    recipientEmail: "real@example.com",
    nodeEnv: "development",
    override: "not-an-email",
  });
  assert.equal(r.to, "real@example.com");
  assert.equal(r.overridden, false);
}

assert.equal(
  isNotificationsProductionRuntime({
    nodeEnv: "production",
    vercelEnv: "preview",
  }),
  false,
);
assert.equal(
  isNotificationsProductionRuntime({
    nodeEnv: "production",
    vercelEnv: "production",
  }),
  true,
);

console.log("email-override.test.ts: OK");
