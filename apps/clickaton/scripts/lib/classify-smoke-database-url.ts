/**
 * Clasificación explícita de DATABASE_URL para smoke Mercado Pago TEST.
 * Fail-closed: neon.tech solo no implica producción ni staging.
 */

export type SmokeDatabaseClass =
  | "production"
  | "staging"
  | "test"
  | "local"
  | "unknown";

export type SmokeDatabaseClassification = {
  classification: SmokeDatabaseClass;
  safeForTestSmoke: boolean;
  reason: string;
};

const STAGING_MARKER = /(^|[/?#._-])(staging|stg|preview)([/?#._-]|$)/i;
const TEST_MARKER = /(^|[/?#._-])(test|testing|sandbox)([/?#._-]|$)/i;

function parsePgUrl(raw: string): { host: string; database: string } {
  try {
    const normalized = raw.replace(/^postgresql:/i, "http:").replace(/^postgres:/i, "http:");
    const u = new URL(normalized);
    const database = decodeURIComponent((u.pathname || "/").replace(/^\//, "").split("/")[0] ?? "");
    return { host: (u.hostname || "").toLowerCase(), database: database.toLowerCase() };
  } catch {
    return { host: "", database: "" };
  }
}

/**
 * Clasifica una DATABASE_URL para el smoke de pagos TEST.
 * No imprime ni registra el valor.
 */
export function classifySmokeDatabaseUrl(
  raw: string | undefined,
): SmokeDatabaseClassification {
  if (!raw || !raw.trim()) {
    return {
      classification: "unknown",
      safeForTestSmoke: false,
      reason: "absent",
    };
  }

  const v = raw.toLowerCase();
  const { host, database } = parsePgUrl(raw);
  const haystack = `${host}/${database}`;

  if (v.includes("maratonfotografica.com")) {
    return {
      classification: "production",
      safeForTestSmoke: false,
      reason: "production_domain_marker",
    };
  }

  if (host === "localhost" || host === "127.0.0.1") {
    return {
      classification: "local",
      safeForTestSmoke: true,
      reason: "local_host",
    };
  }

  if (STAGING_MARKER.test(haystack) || STAGING_MARKER.test(v)) {
    return {
      classification: "staging",
      safeForTestSmoke: true,
      reason: "explicit_staging_marker",
    };
  }

  if (TEST_MARKER.test(haystack) || TEST_MARKER.test(v)) {
    return {
      classification: "test",
      safeForTestSmoke: true,
      reason: "explicit_test_marker",
    };
  }

  if (v.includes("neon.tech")) {
    return {
      classification: "unknown",
      safeForTestSmoke: false,
      reason: "neon_without_staging_or_test_marker",
    };
  }

  return {
    classification: "unknown",
    safeForTestSmoke: false,
    reason: "unclassified_database_url",
  };
}

/** True solo si la URL está clasificada como apta para smoke TEST (no producción). */
export function isProductionLikeDatabaseUrl(raw: string | undefined): boolean {
  const c = classifySmokeDatabaseUrl(raw);
  return c.classification === "production";
}
