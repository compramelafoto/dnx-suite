import { loadResendWebhookConfig } from "@repo/communications/tracking/resend";
import { STAGING_TECHNICAL_TRACKING_EVENTS } from "@repo/communications";
import { classifySmokeDatabaseUrl } from "../../../scripts/lib/classify-smoke-database-url";

export type ReadinessStatus = "READY" | "READY WITH WARNINGS" | "NOT READY";

export type ReadinessDbMode = "local" | "staging_explicit" | "remote_health";

export type ReadinessReport = {
  status: ReadinessStatus;
  phase: "A_prepared" | "B_exposed_disabled" | "C_verify_only" | "D_process" | "unknown";
  dbMode: ReadinessDbMode;
  checks: Record<string, { ok: boolean; detail?: string }>;
  warnings: string[];
};

export type ReadinessDeps = {
  env: Readonly<Record<string, string | undefined>>;
  /**
   * Modo de chequeo de DB:
   * - staging_explicit (default CLI): exige COMMUNICATIONS_STAGING_DATABASE_URL
   * - local: solo diagnóstico; no usar para go-live staging
   * - remote_health: no consulta DB local; schema vía ping opcional remoto
   */
  dbMode?: ReadinessDbMode;
  pingDatabase?: () => Promise<{ ok: boolean; tableReady?: boolean; uniqueReady?: boolean }>;
};

function parsePg(raw: string): { host: string; database: string } {
  try {
    const normalized = raw
      .replace(/^postgresql:/i, "http:")
      .replace(/^postgres:/i, "http:");
    const u = new URL(normalized);
    return {
      host: (u.hostname || "").toLowerCase(),
      database: decodeURIComponent(
        (u.pathname || "/").replace(/^\//, "").split("/")[0] ?? "",
      ).toLowerCase(),
    };
  } catch {
    return { host: "", database: "" };
  }
}

function expectedHostPrefix(env: Readonly<Record<string, string | undefined>>): string {
  return (
    env.COMMUNICATIONS_EXPECTED_HOST_PREFIX ??
    env.COMMUNICATIONS_EXPECTED_DATABASE_HOST ??
    "ep-round-fog"
  )
    .trim()
    .toLowerCase();
}

function expectedDatabaseName(
  env: Readonly<Record<string, string | undefined>>,
): string {
  return (env.COMMUNICATIONS_EXPECTED_DATABASE_NAME ?? "neondb")
    .trim()
    .toLowerCase();
}

export async function evaluateResendWebhookReadiness(
  deps: ReadinessDeps,
): Promise<ReadinessReport> {
  const warnings: string[] = [];
  const checks: ReadinessReport["checks"] = {};
  const env = deps.env;
  const dbMode: ReadinessDbMode = deps.dbMode ?? "staging_explicit";

  const loaded = loadResendWebhookConfig(env);
  checks.config = {
    ok: loaded.ok,
    detail: loaded.ok ? "ok" : loaded.errorMessage,
  };

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
    checks.mode = { ok: false, detail: "process_not_allowed_in_staging_go_live" };
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

  const stagingUrlExplicit = env.COMMUNICATIONS_STAGING_DATABASE_URL?.trim() ?? "";
  const hostPrefix = expectedHostPrefix(env);
  const dbNameExpected = expectedDatabaseName(env);

  if (dbMode === "staging_explicit") {
    checks.explicitStagingUrl = {
      ok: Boolean(stagingUrlExplicit),
      detail: stagingUrlExplicit ? "present" : "COMMUNICATIONS_STAGING_DATABASE_URL_absent",
    };
    checks.noDatabaseUrlFallback = {
      ok: true,
      detail: "staging_explicit_ignores_DATABASE_URL",
    };

    if (!stagingUrlExplicit) {
      checks.databaseIdentity = {
        ok: false,
        detail: "staging_url_required",
      };
      checks.databaseReachable = { ok: false, detail: "skipped_no_staging_url" };
      checks.schemaTable = { ok: false, detail: "skipped_no_staging_url" };
      checks.uniqueConstraint = { ok: false, detail: "skipped_no_staging_url" };
    } else {
      const dbClass = classifySmokeDatabaseUrl(stagingUrlExplicit);
      const { host, database } = parsePg(stagingUrlExplicit);
      const denylist =
        dbClass.classification === "production" ||
        host.includes("ep-dawn-dew") ||
        /maratonfotografica\.com/i.test(stagingUrlExplicit);
      const hostOk = host.includes(hostPrefix);
      const nameOk = !dbNameExpected || database === dbNameExpected;

      checks.databaseIdentity = {
        ok:
          !denylist &&
          dbClass.classification === "staging" &&
          hostOk &&
          nameOk,
        detail: denylist
          ? "production_or_denylist_blocked"
          : !hostOk
            ? `host_mismatch_expected_${hostPrefix}`
            : !nameOk
              ? `database_mismatch_expected_${dbNameExpected}`
              : `${dbClass.classification}:${dbClass.reason}`,
      };

      if (deps.pingDatabase && checks.databaseIdentity.ok) {
        try {
          const ping = await deps.pingDatabase();
          checks.databaseReachable = { ok: ping.ok };
          checks.schemaTable = {
            ok: ping.tableReady === true,
            detail: String(ping.tableReady),
          };
          checks.uniqueConstraint = {
            ok: ping.uniqueReady === true,
            detail: String(ping.uniqueReady),
          };
        } catch {
          checks.databaseReachable = { ok: false, detail: "ping_failed" };
          checks.schemaTable = { ok: false, detail: "ping_failed" };
          checks.uniqueConstraint = { ok: false, detail: "ping_failed" };
        }
      } else if (!deps.pingDatabase) {
        checks.databaseReachable = { ok: true, detail: "skipped_no_ping" };
        warnings.push("database_ping_skipped");
      } else {
        checks.databaseReachable = { ok: false, detail: "skipped_identity_failed" };
        checks.schemaTable = { ok: false, detail: "skipped_identity_failed" };
        checks.uniqueConstraint = { ok: false, detail: "skipped_identity_failed" };
      }
    }
  } else if (dbMode === "local") {
    warnings.push("db_mode_local_not_valid_for_staging_go_live");
    const localUrl = env.DATABASE_URL?.trim() ?? "";
    const dbClass = classifySmokeDatabaseUrl(localUrl || undefined);
    checks.databaseIdentity = {
      ok:
        dbClass.classification === "staging" ||
        dbClass.classification === "local" ||
        dbClass.classification === "test",
      detail: `${dbClass.classification}:${dbClass.reason}`,
    };
    if (dbClass.classification === "production") {
      checks.databaseIdentity = { ok: false, detail: "production_blocked" };
    }
    if (deps.pingDatabase) {
      try {
        const ping = await deps.pingDatabase();
        checks.databaseReachable = { ok: ping.ok };
        checks.schemaTable = {
          ok: ping.tableReady === true,
          detail: String(ping.tableReady),
        };
        checks.uniqueConstraint = {
          ok: ping.uniqueReady === true,
          detail: String(ping.uniqueReady),
        };
      } catch {
        checks.databaseReachable = { ok: false, detail: "ping_failed" };
      }
    } else {
      checks.databaseReachable = { ok: true, detail: "skipped_no_ping" };
      warnings.push("database_ping_skipped");
    }
  } else {
    // remote_health: no usa DATABASE_URL local; schema solo si hay ping inyectado.
    checks.databaseIdentity = {
      ok: true,
      detail: "remote_health_mode_no_local_db",
    };
    checks.noDatabaseUrlFallback = {
      ok: true,
      detail: "remote_health_ignores_DATABASE_URL",
    };
    if (deps.pingDatabase) {
      try {
        const ping = await deps.pingDatabase();
        checks.databaseReachable = { ok: ping.ok };
        checks.schemaTable = {
          ok: ping.tableReady === true,
          detail: String(ping.tableReady),
        };
        checks.uniqueConstraint = {
          ok: ping.uniqueReady === true,
          detail: String(ping.uniqueReady),
        };
      } catch {
        checks.databaseReachable = { ok: false, detail: "ping_failed" };
      }
    } else {
      checks.databaseReachable = { ok: true, detail: "skipped_no_ping" };
      warnings.push("database_ping_skipped");
    }
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

  const stagingWebhookUrl =
    env.COMMUNICATIONS_WEBHOOK_STAGING_URL ??
    "https://clickaton-staging.vercel.app/api/webhooks/resend";
  checks.stagingUrl = {
    ok: stagingWebhookUrl.includes("clickaton-staging.vercel.app"),
    detail: stagingWebhookUrl.includes("maratonfotografica.com")
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

  if (phase === "A_prepared" || phase === "B_exposed_disabled") {
    if (status === "READY") status = "READY WITH WARNINGS";
    if (phase === "B_exposed_disabled" && !env.RESEND_WEBHOOK_SECRET?.trim()) {
      warnings.push("READY FOR RESEND WEBHOOK SECRET");
    } else {
      warnings.push(`activation_phase_${phase}_not_receiving`);
    }
  }
  if (phase === "D_process") {
    status = "NOT READY";
  }
  if (dbMode === "local" && status !== "NOT READY") {
    status = "NOT READY";
    warnings.push("local_db_mode_blocks_go_live_ready");
  }

  return { status, phase, dbMode, checks, warnings };
}
