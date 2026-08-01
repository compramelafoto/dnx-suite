/**
 * Read-only safety gate for staging email tests. Never sends an email.
 */
import { pathToFileURL } from "node:url";
import {
  isClickatonProductionAudience,
  isClickatonProductionPublicOrigin,
  resolveClickatonPublicOrigin,
} from "../lib/site/public-origin";
import { assertStagingPublicUrls } from "./lib/assert-staging-public-urls";

type Readiness = { status: string; blockers: string[]; origin: string };

export function getResendStagingReadiness(
  env: NodeJS.ProcessEnv = process.env,
): Readiness {
  const blockers: string[] = [];
  const origin = resolveClickatonPublicOrigin(env);
  if (env.CLICKATON_EMAIL_DRY_RUN !== "true") blockers.push("BLOCKED_NO_DRY_RUN");
  if (
    !env.CLICKATON_EMAIL_TEST_TO?.trim() &&
    !env.CLICKATON_EMAIL_FALLBACK_TO?.trim() &&
    env.CLICKATON_EMAIL_ALLOW_ANY !== "true"
  ) {
    blockers.push("BLOCKED_NO_ALLOWLIST");
  }
  if (!env.RESEND_API_KEY?.trim()) blockers.push("BLOCKED_NO_RESEND_API_KEY");
  if (!env.COMMUNICATIONS_RESEND_WEBHOOK?.trim()) blockers.push("BLOCKED_NO_WEBHOOK");
  try {
    assertStagingPublicUrls({ env, expectStaging: true });
  } catch {
    blockers.push("BLOCKED_PRODUCTION_ORIGIN");
  }
  if (isClickatonProductionPublicOrigin(origin) || isClickatonProductionAudience(env)) {
    blockers.push("BLOCKED_PRODUCTION_AUDIENCE");
  }
  return { status: blockers.length ? blockers[0] : "READY_FOR_SAFE_TEST", blockers, origin };
}

const isMain =
  process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  console.log(JSON.stringify(getResendStagingReadiness()));
}
