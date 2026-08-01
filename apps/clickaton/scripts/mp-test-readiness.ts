/**
 * Readiness read-only for Mercado Pago sandbox. Never creates a payment.
 *
 *   pnpm --filter clickaton readiness:mp-test
 */
import { pathToFileURL } from "node:url";
import {
  isClickatonCardBrickCheckoutEnabled,
  resolveClickatonMercadoPagoPublicKey,
} from "../lib/checkout/card-brick-enabled";
import {
  isClickatonProductionPublicOrigin,
  resolveClickatonPublicOrigin,
  STAGING_SITE_ORIGIN,
} from "../lib/site/public-origin";
import { assertStagingPublicUrls } from "./lib/assert-staging-public-urls";
import { assertStagingVercelTarget } from "./lib/assert-staging-vercel-target";

export type MpTestReadiness = {
  status: string;
  blockers: string[];
  origin: string;
  checks: Record<string, "pass" | "fail" | "unknown">;
};

function classifyToken(value: string | undefined): "test" | "unverified" | "missing" {
  if (!value?.trim()) return "missing";
  const v = value.trim();
  if (v.startsWith("TEST-")) return "test";
  // APP_USR-* only accepted as TEST when attestation source is explicit.
  if (
    v.startsWith("APP_USR-") &&
    process.env.MERCADOPAGO_CREDENTIALS_SOURCE?.trim() === "credenciales_de_prueba"
  ) {
    return "unverified";
  }
  if (v.startsWith("TEST-")) return "test";
  return "unverified";
}

export function getMpTestReadiness(
  env: NodeJS.ProcessEnv = process.env,
): MpTestReadiness {
  const blockers: string[] = [];
  const checks: MpTestReadiness["checks"] = {
    publicOrigin: "unknown",
    vercelTarget: "unknown",
    publicKey: "unknown",
    accessToken: "unknown",
    credentialsSource: "unknown",
    cardBrickFlags: "unknown",
    returnUrls: "unknown",
  };

  const origin = resolveClickatonPublicOrigin(env);
  try {
    assertStagingPublicUrls({ env, expectStaging: true });
    checks.returnUrls = "pass";
  } catch {
    blockers.push("BLOCKED_RETURN_URL_PRODUCTION");
    checks.returnUrls = "fail";
  }
  if (isClickatonProductionPublicOrigin(origin)) {
    blockers.push("BLOCKED_RETURN_URL_PRODUCTION");
    checks.publicOrigin = "fail";
  } else if (origin === STAGING_SITE_ORIGIN || /clickaton-staging/i.test(origin)) {
    checks.publicOrigin = "pass";
  } else {
    checks.publicOrigin = "fail";
    blockers.push("BLOCKED_STAGING_OFFER");
  }

  const vercel = assertStagingVercelTarget({
    cwd: process.cwd(),
    envProjectId: env.VERCEL_PROJECT_ID,
    envProjectName: env.VERCEL_PROJECT_NAME,
  });
  if (!vercel.ok) {
    blockers.push("BLOCKED_STAGING_OFFER");
    checks.vercelTarget = "fail";
  } else {
    checks.vercelTarget = "pass";
  }

  const publicKey = resolveClickatonMercadoPagoPublicKey(env);
  if (!publicKey) {
    blockers.push("BLOCKED_MISSING_PUBLIC_KEY");
    checks.publicKey = "fail";
  } else if (!publicKey.startsWith("TEST-")) {
    blockers.push("BLOCKED_UNVERIFIED_CREDENTIAL_TYPE");
    checks.publicKey = "fail";
  } else {
    checks.publicKey = "pass";
  }

  const credentialsSource = env.MERCADOPAGO_CREDENTIALS_SOURCE?.trim();
  if (credentialsSource !== "credenciales_de_prueba") {
    blockers.push("BLOCKED_UNVERIFIED_CREDENTIAL_TYPE");
    checks.credentialsSource = "fail";
  } else {
    checks.credentialsSource = "pass";
  }

  const accessToken =
    env.MERCADOPAGO_TEST_ACCESS_TOKEN?.trim() ||
    env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  const tokenClass = classifyToken(accessToken);
  if (tokenClass === "missing") {
    blockers.push("BLOCKED_MISSING_ACCESS_TOKEN");
    checks.accessToken = "fail";
  } else if (tokenClass !== "test") {
    blockers.push("BLOCKED_UNVERIFIED_CREDENTIAL_TYPE");
    checks.accessToken = "fail";
  } else {
    checks.accessToken = "pass";
  }

  // Collector: without a non-transactional identity call we cannot attest TEST.
  if (!env.MERCADOPAGO_TEST_OWNER_USER_ID?.trim()) {
    blockers.push("BLOCKED_COLLECTOR_NOT_TEST");
  }

  const webhook =
    env.DNX_PAYMENTS_WEBHOOK_PUBLIC_URL?.trim() ||
    env.CLICKATON_PAYMENTS_WEBHOOK_URL?.trim();
  if (webhook && /maratonfotografica\.com/i.test(webhook)) {
    blockers.push("BLOCKED_WEBHOOK_CONFIGURATION");
  } else if (!webhook) {
    blockers.push("BLOCKED_WEBHOOK_CONFIGURATION");
  }

  if (!isClickatonCardBrickCheckoutEnabled(env)) {
    blockers.push("BLOCKED_STAGING_OFFER");
    checks.cardBrickFlags = "fail";
  } else {
    checks.cardBrickFlags = "pass";
  }

  const unique = [...new Set(blockers)];
  return {
    status: unique.length ? unique[0]! : "READY_FOR_TEST",
    blockers: unique,
    origin,
    checks,
  };
}

const isMain =
  process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  console.log(JSON.stringify(getMpTestReadiness()));
}
