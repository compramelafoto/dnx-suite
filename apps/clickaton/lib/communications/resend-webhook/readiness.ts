import { loadResendWebhookConfig } from "@repo/communications/tracking/resend";
import { STAGING_TECHNICAL_TRACKING_EVENTS } from "@repo/communications";
import { classifySmokeDatabaseUrl } from "../../../scripts/lib/classify-smoke-database-url";

export type ReadinessStatus = "READY" | "READY WITH WARNINGS" | "NOT READY";

export type ReadinessReport = {
  status: ReadinessStatus;
  phase: "A_prepared" | "B_exposed_disabled" | "C_verify_only" | "D_process" | "unknown";
  checks: Record<string, { ok: boolean; detail?: string }>;
  warnings: string[];
};

export type ReadinessDeps = {
  env: Readonly<Record<string, string | undefined>>;
  pingDatabase?: () => Promise<{ ok: boolean; tableReady?: boolean; uniqueReady?: boolean }>;
};

export async function evaluateResendWebhookReadiness(
  deps: ReadinessDeps,
): Promise<ReadinessReport> {
  const warnings: string[] = [];
  const checks: ReadinessReport["checks"] = {};
  const env = deps.env;

  const loaded = loadResendWebhookConfig(env);
  checks.config = {
    ok: loaded.ok,
    detail: loaded.ok ? "ok" : loaded.errorMessage,
  };

  // Flags leídos del env (aunque load falle por secret ausente).
  const enabledFlag = ["true", "1", "yes"].includes(
    (env.COMMUNICATIONS_RESEND_WEBHOOK_ENABLED ?? "false").trim().toLowerCase(),
  );
  const modeRaw = (env.COMMUNICATIONS_WEBHOOK_MODE ?? "disabled")
    .trim()
    .toLowerCase();
  const mode =
    modeRaw === "verify_only" || modeRaw === "process" || modeRaw === "disabled"
      ? modeRaw
      : "disabled";
  const enabled = enabledFlag;

  let phase: ReadinessReport["phase"] = "unknown";
  if (!enabled) phase = "A_prepared";
  else if (mode === "disabled") phase = "B_exposed_disabled";
  else if (mode === "verify_only") phase = "C_verify_only";
  else if (mode === "process") phase = "D_process";

  checks.featureFlag = { ok: true, detail: enabled ? "true" : "false" };
  checks.mode = {
    ok: mode === "verify_only" || mode === "disabled" || !enabled,
    detail: mode,
  };
  if (mode === "process") {
    checks.mode = { ok: false, detail: "process_not_allowed_in_imp07" };
  }

  checks.secretPresent = {
    ok:
      !enabled ||
      mode === "disabled" ||
      Boolean(env.RESEND_WEBHOOK_SECRET?.trim()),
    detail: env.RESEND_WEBHOOK_SECRET?.trim() ? "present" : "absent",
  };

  checks.maxBytes = {
    ok: loaded.ok && loaded.config.maxBytes > 0 && loaded.config.maxBytes <= 262_144,
    detail: loaded.ok ? String(loaded.config.maxBytes) : "n/a",
  };

  const allowed = loaded.ok ? loaded.config.environmentPolicy.allowedEvents : [];
  const hasBehavioral = allowed.some(
    (e) => e === "email.opened" || e === "email.clicked",
  );
  checks.allowedEvents = {
    ok: loaded.ok && allowed.length > 0 && !hasBehavioral,
    detail: loaded.ok
      ? `${allowed.length}_events_behavioral_${hasBehavioral ? "present" : "blocked"}`
      : "n/a",
  };
  if (hasBehavioral) {
    warnings.push("allowed_events_includes_behavioral");
  }

  checks.productEffectsDisabled = {
    ok: !loaded.ok || loaded.config.environmentPolicy.productEffectsEnabled === false,
    detail: "false",
  };
  checks.persistBehavioralDisabled = {
    ok: !loaded.ok || loaded.config.environmentPolicy.persistBehavioralEvents === false,
    detail: String(loaded.ok && loaded.config.environmentPolicy.persistBehavioralEvents),
  };

  const dbClass = classifySmokeDatabaseUrl(env.DATABASE_URL);
  checks.databaseIdentity = {
    ok:
      dbClass.classification === "staging" ||
      dbClass.classification === "local" ||
      dbClass.classification === "test",
    detail: `${dbClass.classification}:${dbClass.reason}`,
  };
  if (dbClass.classification === "production") {
    checks.databaseIdentity = {
      ok: false,
      detail: "production_blocked",
    };
  }

  if (deps.pingDatabase) {
    try {
      const ping = await deps.pingDatabase();
      checks.databaseReachable = { ok: ping.ok };
      checks.schemaTable = { ok: ping.tableReady !== false, detail: String(ping.tableReady) };
      checks.uniqueConstraint = {
        ok: ping.uniqueReady !== false,
        detail: String(ping.uniqueReady),
      };
    } catch {
      checks.databaseReachable = { ok: false, detail: "ping_failed" };
    }
  } else {
    checks.databaseReachable = { ok: true, detail: "skipped_no_ping" };
    warnings.push("database_ping_skipped");
  }

  checks.rateLimitConfigured = {
    ok: true,
    detail: loaded.ok
      ? loaded.config.rateLimit.enabled
        ? "memory_best_effort"
        : "noop_documented"
      : "n/a",
  };
  if (loaded.ok && loaded.config.rateLimit.enabled) {
    warnings.push("rate_limit_is_best_effort_not_durable");
  }

  checks.alerts = {
    ok: true,
    detail: loaded.ok && loaded.config.alerts.enabled ? "enabled_noop_sink" : "disabled",
  };

  const stagingUrl =
    env.COMMUNICATIONS_WEBHOOK_STAGING_URL ??
    "https://clickaton-staging.vercel.app/api/webhooks/resend";
  checks.stagingUrl = {
    ok: stagingUrl.includes("clickaton-staging.vercel.app"),
    detail: stagingUrl.includes("maratonfotografica.com")
      ? "production_url_detected"
      : "staging_ok",
  };

  checks.technicalAllowlistDefault = {
    ok: STAGING_TECHNICAL_TRACKING_EVENTS.length === 7,
    detail: String(STAGING_TECHNICAL_TRACKING_EVENTS.length),
  };

  const failed = Object.entries(checks).filter(([, v]) => !v.ok);
  let status: ReadinessStatus = "READY";
  if (failed.length > 0) status = "NOT READY";
  else if (warnings.length > 0) status = "READY WITH WARNINGS";

  // Fase A/B pueden ser "ready" para preparación pero no para recepción.
  if (phase === "A_prepared" || phase === "B_exposed_disabled") {
    if (status === "READY") status = "READY WITH WARNINGS";
    warnings.push(`activation_phase_${phase}_not_receiving`);
  }
  if (phase === "D_process") {
    status = "NOT READY";
  }

  return { status, phase, checks, warnings };
}
