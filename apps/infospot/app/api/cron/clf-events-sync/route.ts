/**
 * Cron staging-safe: sync inbound de eventos CLF → Info Spot.
 *
 * Auth: Authorization: Bearer $CRON_SECRET (o x-cron-secret).
 * Sin secreto configurado → 503 (no ejecuta).
 * No activar en vercel.json de producción hasta autorización explícita.
 */
import { NextRequest, NextResponse } from "next/server";
import { reconcilePublicClfEvents } from "@/lib/clf-event-sync/reconcile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const globalLock = globalThis as unknown as {
  __infospotClfSyncLockUntil?: number;
};

function authorize(req: NextRequest): boolean {
  /* eslint-disable turbo/no-undeclared-env-vars -- cron auth secret */
  const secret = process.env.CRON_SECRET?.trim();
  /* eslint-enable turbo/no-undeclared-env-vars */
  if (!secret) return false;
  const header = req.headers.get("authorization") || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const alt = req.headers.get("x-cron-secret")?.trim() || "";
  return bearer === secret || alt === secret;
}

export async function GET(req: NextRequest) {
  /* eslint-disable turbo/no-undeclared-env-vars -- cron auth secret */
  const cronConfigured = Boolean(process.env.CRON_SECRET?.trim());
  /* eslint-enable turbo/no-undeclared-env-vars */
  if (!cronConfigured) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET not configured" },
      { status: 503 },
    );
  }
  if (!authorize(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  if ((globalLock.__infospotClfSyncLockUntil ?? 0) > now) {
    return NextResponse.json(
      { ok: false, error: "locked", retryAfterMs: globalLock.__infospotClfSyncLockUntil! - now },
      { status: 429 },
    );
  }

  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dryRun") === "1";
  const limitRaw = Number(url.searchParams.get("limit") || "50");
  const limit = Number.isFinite(limitRaw)
    ? Math.min(100, Math.max(1, Math.trunc(limitRaw)))
    : 50;

  globalLock.__infospotClfSyncLockUntil = now + 55_000;
  const started = Date.now();
  try {
    const summary = await reconcilePublicClfEvents({ dryRun, limit });
    return NextResponse.json({
      ok: summary.failed === 0,
      job: "clf-events-sync",
      dryRun,
      limit,
      durationMs: Date.now() - started,
      scanned: summary.scanned,
      created: summary.created,
      updated: summary.updated,
      unchanged: summary.unchanged,
      skipped: summary.skipped,
      stale: summary.stale,
      failed: summary.failed,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        job: "clf-events-sync",
        error: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - started,
      },
      { status: 500 },
    );
  } finally {
    globalLock.__infospotClfSyncLockUntil = Date.now() + 1_000;
  }
}
