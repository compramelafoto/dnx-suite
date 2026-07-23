/**
 * Staging DB host allowlist for Financial Identity remote ops.
 * Confirmed Clickatón/DNX shared staging: ep-divine-smoke-av8hmt7s*
 * Legacy documented CLF preview: ep-round-fog* (kept for compatibility).
 */

const ALLOWED_HOST_PREFIXES = [
  "ep-divine-smoke-av8hmt7s",
  "ep-round-fog",
] as const;

const FORBIDDEN_HOST_SNIPPETS = [
  "ep-dawn-dew",
  "ep-falling-darkness",
  "ep-bitter-salad",
] as const;

export function hostOf(url: string | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).hostname;
  } catch {
    const m = url.match(/@([^/?]+)/);
    return m?.[1] ?? "";
  }
}

export function assertFinancialIdentityStagingHost(input?: {
  databaseUrl?: string;
  directUrl?: string;
}): { host: string; database: string } {
  const databaseUrl = input?.databaseUrl ?? process.env.DATABASE_URL ?? "";
  const directUrl = input?.directUrl ?? process.env.DIRECT_URL ?? "";
  const host = hostOf(directUrl || databaseUrl);
  const path = (() => {
    try {
      return new URL(directUrl || databaseUrl).pathname.replace(/^\//, "").split("?")[0] ?? "";
    } catch {
      return "";
    }
  })();

  for (const bad of FORBIDDEN_HOST_SNIPPETS) {
    if (host.includes(bad)) {
      throw new Error(
        `STAGING_GATE_FAILED: forbidden host snippet ${bad} (got prefix=${host.slice(0, 28) || "missing"})`,
      );
    }
  }

  const allowed = ALLOWED_HOST_PREFIXES.some((p) => host.startsWith(p));
  if (!allowed || !host.includes("neon.tech")) {
    throw new Error(
      `STAGING_GATE_FAILED: expected ep-divine-smoke-av8hmt7s* or ep-round-fog*, got prefix=${host.slice(0, 28) || "missing"}`,
    );
  }

  if (host.startsWith("ep-divine-smoke") && path && path !== "clickaton_staging") {
    throw new Error(
      `STAGING_GATE_FAILED: divine-smoke must use database clickaton_staging (got ${path || "missing"})`,
    );
  }

  return { host, database: path };
}
