/**
 * Smoke R2 staging real (sube fixture → HEAD → signed → delete).
 * No usa fotos de participantes. No deja objetos huérfanos.
 *
 * FOTORANK_PRIVATE_STORAGE_PROVIDER=r2 \
 * FOTORANK_R2_* = ... \
 *   pnpm --filter fotorank run test:storage:r2-staging
 *
 * Si faltan credenciales → SKIP documentado (no PASS falso).
 */
import { createR2PrivateContestStorageProvider, r2PrivateStorageConfigSelfcheck } from "./r2-private-storage";

async function main() {
  const cfg = r2PrivateStorageConfigSelfcheck();
  if (!cfg.configured) {
    console.log(
      JSON.stringify(
        {
          status: "SKIP",
          reason: "Sin credenciales R2 staging",
          missing: cfg.missing,
          note: "Bloqueador externo: configurar FOTORANK_R2_* de staging (nunca prod bucket fotorank-uploads). SKIP ≠ PASS para Go/No-Go.",
        },
        null,
        2,
      ),
    );
    // P0-08b: no declarar éxito implícito; exit ≠ 0 para gates de release.
    process.exitCode = 2;
    return;
  }

  if (cfg.bucket && /uploads$/i.test(cfg.bucket) && !/staging/i.test(cfg.bucket)) {
    throw new Error(`ABORT: bucket parece productivo (${cfg.bucket}). Usá *-staging.`);
  }

  const storage = createR2PrivateContestStorageProvider();
  if (!storage) throw new Error("Provider R2 no disponible");

  const key = `fotorank/smoke/p0-08/${Date.now()}-fixture.txt`;
  const body = new TextEncoder().encode(`fotorank-p0-08-smoke ${new Date().toISOString()}`);
  const steps: Record<string, string> = {};

  try {
    await storage.putObject(key, body, "text/plain");
    steps.put = "OK";
    const head = await storage.headObject?.(key);
    steps.head = head?.exists ? "OK" : "FAIL";
    const url = await storage.getSignedUrl(key, "read", 120);
    steps.signedUrl = url.includes("http") || url.includes("private-asset") ? "OK" : "FAIL";
    // No imprimir URL completa
    steps.signedUrlShape = url.startsWith("http") ? "https://…" : url.split("?")[0] ?? "relative";
    steps.publicUrlAssumedBlocked = "NOT_TESTED_DIRECTLY — bucket privado requerido; ver runbook";
    const read = await storage.readObject?.(key);
    steps.readBack = read && read.byteLength === body.byteLength ? "OK" : "FAIL";
  } finally {
    try {
      await storage.deleteObject(key);
      steps.delete = "OK";
      const gone = await storage.objectExists?.(key);
      steps.deleteVerified = gone === false ? "OK" : "WARN_STILL_EXISTS";
    } catch {
      steps.delete = "FAIL";
    }
  }

  const failed = Object.values(steps).some((v) => v === "FAIL");
  console.log(
    JSON.stringify(
      {
        status: failed ? "FAIL" : "PASS",
        bucket: cfg.bucket ? `${cfg.bucket.slice(0, 4)}…` : null,
        endpointHost: cfg.endpointHost,
        fixtureKey: key,
        steps,
      },
      null,
      2,
    ),
  );
  if (failed) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
