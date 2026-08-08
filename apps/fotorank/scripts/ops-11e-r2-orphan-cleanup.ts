/**
 * ETAPA 11E — probe/ejecución del endpoint interno de limpieza de objetos R2 huérfanos.
 *
 * Dry-run (default): lista objetos bajo fotorank/contests/{contestId}/.
 * Apply:
 *   SFEF11E_R2_APPLY=1 FOTORANK_ALLOW_PROD_R2=1 \
 *     pnpm --filter fotorank exec tsx scripts/ops-11e-r2-orphan-cleanup.ts
 *
 * Auth: Bearer FOTORANK_INTERNAL_ASSET_SECRET (env) o contenido de /tmp/sfef11d-internal-asset.secret.
 * contestId por defecto: SFEF11D_CONTEST_ID de /tmp/clickaton-11d-fixture.env (cmsk5blnd0005it8lfv7f4vdf).
 */
import { readFileSync } from "node:fs";

const DEFAULT_CONTEST_ID = "cmsk5blnd0005it8lfv7f4vdf";
const CONFIRM_PHRASE = "DELETE_FIXTURE_R2_ORPHANS";

function loadEnvFile(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#") || !t.includes("=")) continue;
      const i = t.indexOf("=");
      out[t.slice(0, i)] = t.slice(i + 1);
    }
  } catch {
    // archivo ausente: se ignora, se usan defaults.
  }
  return out;
}

function resolveSecret(): string {
  const fromEnv = process.env.FOTORANK_INTERNAL_ASSET_SECRET?.trim();
  if (fromEnv && fromEnv.length >= 16) return fromEnv;
  try {
    const fromFile = readFileSync("/tmp/sfef11d-internal-asset.secret", "utf8").trim();
    if (fromFile.length >= 16) return fromFile;
  } catch {
    // sin archivo de secreto: se valida abajo.
  }
  return "";
}

function resolveContestId(): string {
  const fromEnv = process.env.SFEF11E_R2_CONTEST_ID?.trim() || process.env.CONTEST_ID?.trim();
  if (fromEnv) return fromEnv;
  const fixtureFile = loadEnvFile("/tmp/clickaton-11d-fixture.env");
  return fixtureFile.SFEF11D_CONTEST_ID?.trim() || DEFAULT_CONTEST_ID;
}

async function main() {
  const secret = resolveSecret();
  if (secret.length < 16) {
    throw new Error(
      "ABORT: secreto ausente. Definí FOTORANK_INTERNAL_ASSET_SECRET o /tmp/sfef11d-internal-asset.secret",
    );
  }

  const base = (
    process.env.FOTORANK_INTERNAL_ASSET_BASE_URL?.trim() ||
    process.env.FOTORANK_PUBLIC_WEB_BASE_URL?.trim() ||
    "https://fotorank.dnxsuite.com"
  ).replace(/\/$/, "");
  const url = `${base}/api/internal/ops/fixture-r2-cleanup`;

  const contestId = resolveContestId();
  const apply = process.env.SFEF11E_R2_APPLY === "1";

  const body = apply
    ? { contestId, dryRun: false, confirmPhrase: CONFIRM_PHRASE }
    : { contestId, dryRun: true };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));

  console.log(
    JSON.stringify(
      {
        url,
        contestId,
        dryRun: !apply,
        status: res.status,
        response: json,
      },
      null,
      2,
    ),
  );

  if (!res.ok) process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
