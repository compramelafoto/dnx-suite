/**
 * Guard de identidad DB por VERCEL_ENV (ETAPA 11B).
 * Preview → solo Neon staging canónico (ep-round-fog…).
 * Production → nunca staging / CLF / Clickatón ajenos.
 * No imprime URLs ni secretos.
 */

export type DbEnvironment = "preview" | "production" | "development" | "unknown";

/** Prefijos de host Neon staging FotoRank (sin dominio completo). */
export const FOTORANK_STAGING_DB_HOST_PREFIXES = ["ep-round-fog"] as const;

/** Prefijos / marcadores de host productivos conocidos. */
export const FOTORANK_PRODUCTION_DB_HOST_MARKERS = ["ep-dawn-dew"] as const;

/** Hosts / productos ajenos — denylist. */
export const FOREIGN_DB_HOST_MARKERS = [
  "compramelafoto",
  "clickaton",
  "clf-",
  "infospot",
] as const;

export type DbGuardResult =
  | { ok: true; vercelEnv: DbEnvironment; hostHint: string | null }
  | { ok: false; vercelEnv: DbEnvironment; hostHint: string | null; reason: string };

export function resolveVercelEnv(
  raw: string | undefined | null = process.env.VERCEL_ENV,
): DbEnvironment {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "preview") return "preview";
  if (v === "production") return "production";
  if (v === "development") return "development";
  return "unknown";
}

/** Host sanitizado tipo health (`ep-round-fog-…-pooler`). */
export function databaseHostHint(url: string | undefined | null = process.env.DATABASE_URL): string | null {
  if (!url?.trim()) return null;
  const hostMatch = url.match(/@(ep-[a-z0-9-]+(?:-pooler)?)\./i);
  if (hostMatch?.[1]) return hostMatch[1];
  try {
    const host = new URL(url).hostname;
    const m = host.match(/^(ep-[a-z0-9-]+)/i);
    return m?.[1] ?? host.split(".")[0] ?? null;
  } catch {
    return null;
  }
}

export function hostLooksLikeStaging(hostHint: string | null | undefined): boolean {
  if (!hostHint) return false;
  const h = hostHint.toLowerCase();
  return FOTORANK_STAGING_DB_HOST_PREFIXES.some((p) => h.startsWith(p));
}

export function hostLooksLikeProduction(hostHint: string | null | undefined): boolean {
  if (!hostHint) return false;
  const h = hostHint.toLowerCase();
  return FOTORANK_PRODUCTION_DB_HOST_MARKERS.some((p) => h.includes(p));
}

export function hostLooksForeign(hostHint: string | null | undefined, fullUrl?: string | null): boolean {
  const hay = `${hostHint ?? ""} ${fullUrl ?? ""}`.toLowerCase();
  return FOREIGN_DB_HOST_MARKERS.some((m) => hay.includes(m));
}

/**
 * Valida identidad DB según VERCEL_ENV.
 * - preview: exige staging allowlist; rechaza production/foreign.
 * - production: rechaza staging/foreign; espera marcador productivo.
 */
export function assertEnvironmentDatabaseIdentity(input?: {
  vercelEnv?: string | null;
  databaseUrl?: string | null;
}): DbGuardResult {
  const vercelEnv = resolveVercelEnv(input?.vercelEnv ?? process.env.VERCEL_ENV);
  const databaseUrl = input?.databaseUrl ?? process.env.DATABASE_URL ?? null;
  const hostHint = databaseHostHint(databaseUrl);

  if (vercelEnv === "preview") {
    if (!databaseUrl?.trim()) {
      return { ok: false, vercelEnv, hostHint, reason: "PREVIEW_DATABASE_URL_MISSING" };
    }
    if (hostLooksForeign(hostHint, databaseUrl)) {
      return { ok: false, vercelEnv, hostHint, reason: "PREVIEW_DATABASE_FOREIGN_DENIED" };
    }
    if (hostLooksLikeProduction(hostHint) || (hostHint && hostHint.includes("dawn-dew"))) {
      return { ok: false, vercelEnv, hostHint, reason: "PREVIEW_DATABASE_PRODUCTION_DENIED" };
    }
    if (!hostLooksLikeStaging(hostHint)) {
      return { ok: false, vercelEnv, hostHint, reason: "PREVIEW_DATABASE_NOT_STAGING_ALLOWLIST" };
    }
    return { ok: true, vercelEnv, hostHint };
  }

  if (vercelEnv === "production") {
    if (!databaseUrl?.trim()) {
      return { ok: false, vercelEnv, hostHint, reason: "PRODUCTION_DATABASE_URL_MISSING" };
    }
    if (hostLooksLikeStaging(hostHint) || (hostHint && hostHint.includes("round-fog"))) {
      return { ok: false, vercelEnv, hostHint, reason: "PRODUCTION_DATABASE_STAGING_DENIED" };
    }
    if (hostLooksForeign(hostHint, databaseUrl)) {
      return { ok: false, vercelEnv, hostHint, reason: "PRODUCTION_DATABASE_FOREIGN_DENIED" };
    }
    if (!hostLooksLikeProduction(hostHint)) {
      return { ok: false, vercelEnv, hostHint, reason: "PRODUCTION_DATABASE_UNEXPECTED_HOST" };
    }
    return { ok: true, vercelEnv, hostHint };
  }

  // development / unknown: no abort runtime (local), solo reporta.
  return { ok: true, vercelEnv, hostHint };
}

export function assertEnvironmentDatabaseIdentityOrThrow(input?: {
  vercelEnv?: string | null;
  databaseUrl?: string | null;
}): void {
  const result = assertEnvironmentDatabaseIdentity(input);
  if (!result.ok) {
    throw new Error(
      `ABORT DB identity: ${result.reason} (VERCEL_ENV=${result.vercelEnv} hostHint=${result.hostHint ?? "—"})`,
    );
  }
}
