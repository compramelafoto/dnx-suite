/**
 * Comprueba /health y /ready del camera-ftp-gateway.
 *
 * Uso:
 *   npx tsx scripts/camera-connection/camera-connection-gateway-ready.ts
 *   GATEWAY_BASE_URL=http://ftp-staging.internal:8080 npx tsx scripts/camera-connection/camera-connection-gateway-ready.ts
 */
import { loadCameraConnectionEnv } from "./_load-env";

loadCameraConnectionEnv();

const baseUrl = (process.env.GATEWAY_BASE_URL ?? "http://127.0.0.1:8080").replace(/\/$/, "");

async function fetchJson(path: string) {
  const url = `${baseUrl}${path}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  const body = await res.json().catch(() => ({}));
  return { url, status: res.status, body };
}

async function main() {
  console.log(`\nGateway base: ${baseUrl}\n`);

  const health = await fetchJson("/health");
  console.log("GET /health →", health.status);
  console.log(JSON.stringify(health.body, null, 2));

  const ready = await fetchJson("/ready");
  console.log("\nGET /ready →", ready.status);
  console.log(JSON.stringify(ready.body, null, 2));

  if (ready.status !== 200) {
    console.error("\n❌ Gateway NOT READY\n");
    process.exit(1);
  }

  console.log("\n✅ Gateway ready\n");
}

main().catch((err) => {
  console.error("❌ Error consultando gateway:", err instanceof Error ? err.message : err);
  process.exit(1);
});
