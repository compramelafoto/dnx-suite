/**
 * Helpers compartidos — identidad staging DNX Partners (solo lectura).
 * No hace fallback a DATABASE_URL genérica ni a .env local.
 */

export type ClassifyFn = (raw: string | undefined) => {
  classification: string;
  safeForTestSmoke: boolean;
  reason: string;
};

export async function loadClassifier(): Promise<ClassifyFn> {
  const mod = await import(
    "../../../apps/clickaton/scripts/lib/classify-smoke-database-url.ts"
  );
  return mod.classifySmokeDatabaseUrl as ClassifyFn;
}

export function hasFlag(argv: string[], name: string): boolean {
  return argv.includes(name);
}

export function flagValue(argv: string[], name: string): string | null {
  const idx = argv.indexOf(name);
  if (idx >= 0 && argv[idx + 1] && !argv[idx + 1]!.startsWith("--")) {
    return argv[idx + 1]!.trim();
  }
  const pref = `${name}=`;
  for (const a of argv) {
    if (a.startsWith(pref)) return a.slice(pref.length).trim() || null;
  }
  return null;
}

export function parsePg(raw: string): { host: string; database: string } {
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

export function maskHost(host: string): string {
  if (!host) return "absent";
  const m = /^(ep-[a-z0-9-]+)/i.exec(host);
  if (m) return `${m[1]!.slice(0, 18)}…`;
  const parts = host.split(".");
  return `${host.slice(0, 10)}***${parts.length > 1 ? `.${parts.slice(-2).join(".")}` : ""}`;
}

/**
 * Prioridad canónica (sin DATABASE_URL genérica).
 */
export function resolvePartnersStagingUrl(): string {
  return (
    process.env.CLICKATON_STAGING_DATABASE_URL?.trim() ||
    process.env.PARTNERS_STAGING_DATABASE_URL?.trim() ||
    process.env.COMMUNICATIONS_STAGING_DATABASE_URL?.trim() ||
    ""
  );
}

export async function assertPartnersStagingIdentity(stagingUrl: string): Promise<{
  ok: boolean;
  reason: string;
  classification: string;
  host: string;
  database: string;
}> {
  const expectedEnv = (
    process.env.CLICKATON_EXPECTED_DATABASE_ENV ??
    process.env.PARTNERS_EXPECTED_DATABASE_ENV ??
    process.env.COMMUNICATIONS_EXPECTED_DATABASE_ENV ??
    "staging"
  )
    .trim()
    .toLowerCase();
  const expectedHostPrefix = (
    process.env.CLICKATON_EXPECTED_HOST_PREFIX ??
    process.env.PARTNERS_EXPECTED_HOST_PREFIX ??
    process.env.COMMUNICATIONS_EXPECTED_HOST_PREFIX ??
    "ep-round-fog"
  )
    .trim()
    .toLowerCase();
  const expectedName = (
    process.env.CLICKATON_EXPECTED_DATABASE_NAME ??
    process.env.PARTNERS_EXPECTED_DATABASE_NAME ??
    process.env.COMMUNICATIONS_EXPECTED_DATABASE_NAME ??
    "neondb"
  )
    .trim()
    .toLowerCase();

  if (expectedEnv !== "staging") {
    return {
      ok: false,
      reason: "EXPECTED_DATABASE_ENV_must_be_staging",
      classification: "blocked",
      host: "",
      database: "",
    };
  }

  const classify = await loadClassifier();
  const c = classify(stagingUrl);
  const { host, database } = parsePg(stagingUrl);

  if (
    c.classification === "production" ||
    host.includes("ep-dawn-dew") ||
    /maratonfotografica\.com/i.test(stagingUrl) ||
    /clickaton-dnxsuite/i.test(stagingUrl)
  ) {
    return {
      ok: false,
      reason: `production_or_denylist_blocked:${c.reason}`,
      classification: "production",
      host,
      database,
    };
  }
  if (c.classification !== "staging") {
    return {
      ok: false,
      reason: `expected_staging_got_${c.classification}:${c.reason}`,
      classification: c.classification,
      host,
      database,
    };
  }
  if (!host.includes(expectedHostPrefix)) {
    return {
      ok: false,
      reason: `host_prefix_mismatch_expected_${expectedHostPrefix}`,
      classification: c.classification,
      host,
      database,
    };
  }
  if (expectedName && database !== expectedName) {
    return {
      ok: false,
      reason: `database_name_mismatch_expected_${expectedName}`,
      classification: c.classification,
      host,
      database,
    };
  }

  return {
    ok: true,
    reason: c.reason,
    classification: c.classification,
    host,
    database,
  };
}

export const PARTNERS_MIGRATION_DIRS = [
  "20260802120000_dnx_partners_domain",
  "20260802150000_dnx_partner_benefit_access",
  "20260802160000_dnx_partner_assets",
  "20260803120000_dnx_partner_benefit_eligibility",
  "20260803180000_dnx_partner_benefit_auto_sync_caps",
] as const;
