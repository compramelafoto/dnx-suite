/**
 * CLI: pnpm --filter infospot sync:clf-events -- [--dry-run] [--limit N] [--event-id N]
 */

import { loadCliEnv } from "./load-env";
loadCliEnv();

import { reconcilePublicClfEvents } from "./reconcile";

function parseArgs(argv: string[]) {
  let dryRun = false;
  let limit: number | undefined;
  let eventId: number | undefined;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") dryRun = true;
    else if (arg === "--limit") {
      const n = Number(argv[i + 1]);
      if (Number.isFinite(n) && n > 0) {
        limit = Math.trunc(n);
        i += 1;
      }
    } else if (arg === "--event-id") {
      const n = Number(argv[i + 1]);
      if (Number.isFinite(n) && n > 0) {
        eventId = Math.trunc(n);
        i += 1;
      }
    } else if (arg?.startsWith("--limit=")) {
      const n = Number(arg.split("=")[1]);
      if (Number.isFinite(n) && n > 0) limit = Math.trunc(n);
    } else if (arg?.startsWith("--event-id=")) {
      const n = Number(arg.split("=")[1]);
      if (Number.isFinite(n) && n > 0) eventId = Math.trunc(n);
    }
  }

  return { dryRun, limit, eventId };
}

async function main() {
  const { dryRun, limit, eventId } = parseArgs(process.argv.slice(2));
  console.log(
    JSON.stringify(
      {
        mode: dryRun ? "dry-run" : "write",
        limit: eventId != null ? 1 : limit ?? 100,
        eventId: eventId ?? null,
      },
      null,
      2,
    ),
  );

  const summary = await reconcilePublicClfEvents({ dryRun, limit, eventId });
  const compact = {
    dryRun: summary.dryRun,
    scanned: summary.scanned,
    created: summary.created,
    updated: summary.updated,
    unchanged: summary.unchanged,
    skipped: summary.skipped,
    stale: summary.stale,
    failed: summary.failed,
    sample: summary.results.slice(0, 20).map((r) => ({
      clfEventId: r.clfEventId,
      ok: r.ok,
      action: r.action,
      infoSpotEventId: r.infoSpotEventId,
      changes: r.changes,
      warnings: r.warnings.map((w) => w.code),
      error: r.ok ? undefined : r.error,
      message: r.ok ? r.message : undefined,
    })),
  };
  console.log(JSON.stringify(compact, null, 2));

  if (summary.failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
