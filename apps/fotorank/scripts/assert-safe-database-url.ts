/**
 * Guard obligatorio antes de migrar / seedear FotoRank.
 * Falla si DATABASE_URL apunta a Neon productiva, hosts productivos o ambiente ambiguo.
 *
 * Uso:
 *   pnpm --filter fotorank exec tsx scripts/assert-safe-database-url.ts
 *   # o importado por scripts de migrate/seed
 */
const PRODUCTIVE_HOST_MARKERS = [
  /neon\.tech/i,
  /\.aws\.neon\./i,
  /fotorank\.com/i,
  /prod/i,
  /production/i,
];

const ALLOWED_LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

const ALLOWED_DB_NAME_PREFIXES = [
  "fotorank_staging",
  "fotorank_p0_",
  "fotorank_local",
  "fotorank_test",
];

export type SafeDbCheckResult = {
  ok: true;
  host: string;
  database: string;
  reason: string;
};

export function assertSafeFotoRankDatabaseUrl(
  url = process.env.DATABASE_URL,
  opts?: { allowNeonStagingExplicit?: boolean },
): SafeDbCheckResult {
  if (!url?.trim()) {
    throw new Error("ABORT: DATABASE_URL no definida.");
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("ABORT: DATABASE_URL inválida.");
  }

  const host = parsed.hostname;
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  const appEnv = (process.env.FOTORANK_APP_ENV || process.env.DNX_APP_ENV || "").toLowerCase();
  const vercelEnv = (process.env.VERCEL_ENV || "").toLowerCase();

  if (appEnv === "production" || appEnv === "prod" || vercelEnv === "production") {
    throw new Error(
      `ABORT: ambiente productivo detectado (FOTORANK_APP_ENV=${appEnv || "—"} VERCEL_ENV=${vercelEnv || "—"}). No migrar desde este script.`,
    );
  }

  if (process.env.FOTORANK_ALLOW_REMOTE_MIGRATE === "1" && opts?.allowNeonStagingExplicit) {
    // Escape hatch documentado — nunca default.
    return {
      ok: true,
      host,
      database,
      reason: "override FOTORANK_ALLOW_REMOTE_MIGRATE=1 (uso consciente)",
    };
  }

  for (const re of PRODUCTIVE_HOST_MARKERS) {
    if (re.test(host) || re.test(database) || re.test(url)) {
      // localhost con nombre "prod" en path no aplica; solo host/url productiva
      if (ALLOWED_LOCAL_HOSTS.has(host) && !/neon\.tech/i.test(url)) continue;
      throw new Error(
        `ABORT: DATABASE_URL parece productiva/remota (host=${host} db=${database}). Usá fotorank_staging_2026 o fotorank_p0_* local.`,
      );
    }
  }

  if (!ALLOWED_LOCAL_HOSTS.has(host)) {
    throw new Error(
      `ABORT: host no local (${host}). Para staging remoto dedicado seteá FOTORANK_ALLOW_REMOTE_MIGRATE=1 conscientemente.`,
    );
  }

  const dbOk = ALLOWED_DB_NAME_PREFIXES.some((p) => database.startsWith(p));
  if (!dbOk) {
    throw new Error(
      `ABORT: nombre de DB no autorizado (${database}). Permitidos: ${ALLOWED_DB_NAME_PREFIXES.join(", ")}*`,
    );
  }

  return {
    ok: true,
    host,
    database,
    reason: "localhost + nombre aislado FotoRank",
  };
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("assert-safe-database-url.ts")) {
  try {
    const r = assertSafeFotoRankDatabaseUrl();
    console.log(JSON.stringify({ host: r.host, database: r.database, reason: r.reason, ok: true }, null, 2));
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(2);
  }
}
