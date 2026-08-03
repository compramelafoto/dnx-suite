import { loadWorkerConfig } from "./config.js";

async function main(): Promise<void> {
  const config = loadWorkerConfig();
  const url = `http://127.0.0.1:${config.port}/internal/health`;
  const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
  const body = (await res.json()) as { ok?: boolean };
  if (!res.ok || !body.ok) {
    process.exit(1);
  }
}

main().catch(() => {
  process.exit(1);
});
