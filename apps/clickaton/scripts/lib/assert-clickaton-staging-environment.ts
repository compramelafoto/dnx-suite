/**
 * Guard de identidad staging Clickatón (DB + Vercel + URL pública).
 * No confía solo en NODE_ENV.
 */
import {
  CLICKATON_PRODUCTION_PROJECT_ID,
  CLICKATON_STAGING_PROJECT_ID,
  assertStagingVercelTarget,
} from "./assert-staging-vercel-target";
import { classifySmokeDatabaseUrl } from "./classify-smoke-database-url";

export const CLICKATON_STAGING_PUBLIC_HOST = "clickaton-staging.vercel.app";
export const CLICKATON_STAGING_DB_HOST_PREFIX = "ep-round-fog";
export const CLICKATON_STAGING_DB_DENYLIST = ["ep-dawn-dew"] as const;
export const CLICKATON_PRODUCTION_DOMAIN_DENYLIST = [
  "maratonfotografica.com",
  "www.maratonfotografica.com",
] as const;

export type ClickatonStagingEnvironmentAssertResult = {
  ok: true;
  vercelProjectId: string;
  vercelProjectName: string;
  dbHostHint: string;
  publicUrlHost: string;
};

export type ClickatonStagingEnvironmentAssertError = {
  ok: false;
  code:
    | "PRODUCTION_DENYLIST"
    | "DB_NOT_STAGING"
    | "VERCEL_NOT_STAGING"
    | "PUBLIC_URL_NOT_STAGING"
    | "MISSING_DATABASE_URL";
  message: string;
  details?: Record<string, unknown>;
};

function hostFromUrl(raw: string): string | null {
  try {
    const normalized = raw.replace(/^postgres(ql)?:/i, "http:");
    return new URL(normalized).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function containsDenylist(value: string, denylist: readonly string[]): string | null {
  const lower = value.toLowerCase();
  for (const item of denylist) {
    if (lower.includes(item.toLowerCase())) return item;
  }
  return null;
}

/**
 * Valida que el entorno operativo sea staging Clickatón.
 * Lanza Error si no lo es (modo estricto).
 */
export function assertClickatonStagingEnvironment(options?: {
  databaseUrl?: string | null;
  publicUrl?: string | null;
  vercelProjectId?: string | null;
  vercelProjectName?: string | null;
  cwd?: string;
  throwOnFail?: boolean;
}): ClickatonStagingEnvironmentAssertResult | ClickatonStagingEnvironmentAssertError {
  const throwOnFail = options?.throwOnFail ?? true;
  /* Staging ops may inject COMMUNICATIONS_STAGING_DATABASE_URL outside turbo.json. */
  const envBag = process.env as Record<string, string | undefined>;
  const databaseUrl = (
    options?.databaseUrl ??
    envBag.COMMUNICATIONS_STAGING_DATABASE_URL ??
    envBag.DATABASE_URL ??
    ""
  ).trim();
  const publicUrl = (
    options?.publicUrl ??
    envBag.CLICKATON_PUBLIC_URL ??
    envBag.CLICKATON_PUBLIC_WEB_BASE_URL ??
    envBag.CLICKATON_E2E_BASE_URL ??
    `https://${CLICKATON_STAGING_PUBLIC_HOST}`
  ).trim();

  const fail = (
    err: ClickatonStagingEnvironmentAssertError
  ): ClickatonStagingEnvironmentAssertError => {
    if (throwOnFail) throw new Error(`${err.code}: ${err.message}`);
    return err;
  };

  if (!databaseUrl) {
    return fail({
      ok: false,
      code: "MISSING_DATABASE_URL",
      message: "DATABASE_URL / COMMUNICATIONS_STAGING_DATABASE_URL ausente",
    });
  }

  const dbHost = hostFromUrl(databaseUrl) ?? "";
  const deniedDb = containsDenylist(dbHost, CLICKATON_STAGING_DB_DENYLIST);
  if (deniedDb) {
    return fail({
      ok: false,
      code: "PRODUCTION_DENYLIST",
      message: `DB host hit denylist (${deniedDb})`,
      details: { dbHostHint: dbHost.replace(/(ep-[a-z]+).*/, "$1…") },
    });
  }

  const cls = classifySmokeDatabaseUrl(databaseUrl);
  if (
    cls.classification !== "staging" ||
    !cls.safeForTestSmoke ||
    !dbHost.includes(CLICKATON_STAGING_DB_HOST_PREFIX)
  ) {
    return fail({
      ok: false,
      code: "DB_NOT_STAGING",
      message: `DB host is not ep-round-fog staging (${cls.reason})`,
      details: {
        classification: cls.classification,
        dbHostHint: dbHost.replace(/(ep-[a-z]+).*/, "$1…"),
      },
    });
  }

  const publicHost = hostFromUrl(publicUrl) ?? "";
  const deniedPublic = containsDenylist(
    publicHost,
    CLICKATON_PRODUCTION_DOMAIN_DENYLIST
  );
  if (deniedPublic || publicHost.includes("clickaton-dnxsuite")) {
    return fail({
      ok: false,
      code: "PRODUCTION_DENYLIST",
      message: `Public URL hits production denylist (${deniedPublic ?? publicHost})`,
      details: { publicHost },
    });
  }
  if (
    publicHost &&
    publicHost !== CLICKATON_STAGING_PUBLIC_HOST &&
    !publicHost.endsWith(".clickaton-staging.vercel.app") &&
    !publicHost.includes("localhost") &&
    !publicHost.includes("127.0.0.1")
  ) {
    return fail({
      ok: false,
      code: "PUBLIC_URL_NOT_STAGING",
      message: `Public URL host is not staging (${publicHost})`,
      details: { publicHost },
    });
  }

  const vercel = assertStagingVercelTarget({
    cwd: options?.cwd,
    envProjectId: options?.vercelProjectId,
    envProjectName: options?.vercelProjectName,
  });
  if (!vercel.ok) {
    return fail({
      ok: false,
      code: "VERCEL_NOT_STAGING",
      message: vercel.abortMessage,
      details: vercel.details,
    });
  }
  if (
    vercel.projectId === CLICKATON_PRODUCTION_PROJECT_ID ||
    (vercel.projectId && vercel.projectId !== CLICKATON_STAGING_PROJECT_ID)
  ) {
    return fail({
      ok: false,
      code: "PRODUCTION_DENYLIST",
      message: "Vercel project id is not clickaton-staging",
    });
  }

  return {
    ok: true,
    vercelProjectId: vercel.projectId,
    vercelProjectName: vercel.projectName,
    dbHostHint: dbHost.replace(/(ep-round-fog)(-[a-z0-9]+).*/, "$1…"),
    publicUrlHost: publicHost || CLICKATON_STAGING_PUBLIC_HOST,
  };
}
