/**
 * Cron staging-safe: reconcile comercial de coberturas públicas.
 * Auth: Bearer CRON_SECRET. Sin secreto → 503.
 * No programar en producción hasta autorización explícita.
 */
import { NextRequest, NextResponse } from "next/server";
import { reconcilePublicCoverageCommercial } from "@/lib/public-coverage/invalidate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const globalLock = globalThis as unknown as {
  __infospotCoverageReconcileLockUntil?: number;
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
  if ((globalLock.__infospotCoverageReconcileLockUntil ?? 0) > now) {
    return NextResponse.json(
      {
        ok: false,
        error: "locked",
        retryAfterMs: globalLock.__infospotCoverageReconcileLockUntil! - now,
      },
      { status: 429 },
    );
  }

  const url = new URL(req.url);
  const takeRaw = Number(url.searchParams.get("limit") || "100");
  const take = Number.isFinite(takeRaw)
    ? Math.min(200, Math.max(1, Math.trunc(takeRaw)))
    : 100;

  globalLock.__infospotCoverageReconcileLockUntil = now + 55_000;
  const started = Date.now();
  try {
    const result = await reconcilePublicCoverageCommercial({ take });
    return NextResponse.json({
      ok: result.ok,
      job: "reconcile-public-coverage",
      take,
      durationMs: Date.now() - started,
      photosUpdated: result.ok ? result.photosUpdated : undefined,
      error: result.ok ? undefined : result.error,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        job: "reconcile-public-coverage",
        error: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - started,
      },
      { status: 500 },
    );
  } finally {
    globalLock.__infospotCoverageReconcileLockUntil = Date.now() + 1_000;
  }
}
