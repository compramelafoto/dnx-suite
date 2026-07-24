/**
 * Cron: procesa outbox DNX Notifications.
 * Auth: Bearer CRON_SECRET (o x-cron-secret).
 */
import { NextRequest, NextResponse } from "next/server";
import { isNotificationCronEnabled } from "@/lib/notifications/feature-flags";
import { runNotificationWorker } from "@/lib/notifications/worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorize(req: NextRequest): boolean {
  /* eslint-disable turbo/no-undeclared-env-vars -- cron auth */
  const secret = process.env.CRON_SECRET?.trim();
  /* eslint-enable turbo/no-undeclared-env-vars */
  if (!secret) return false;
  const header = req.headers.get("authorization") || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const alt = req.headers.get("x-cron-secret")?.trim() || "";
  return bearer === secret || alt === secret;
}

export async function GET(req: NextRequest) {
  /* eslint-disable turbo/no-undeclared-env-vars -- cron auth */
  if (!process.env.CRON_SECRET?.trim()) {
    /* eslint-enable turbo/no-undeclared-env-vars */
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET not configured" },
      { status: 503 },
    );
  }
  if (!authorize(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!isNotificationCronEnabled()) {
    return NextResponse.json(
      { ok: true, paused: true, reason: "DNX_NOTIFICATIONS_CRON_DISABLED" },
      { status: 200 },
    );
  }

  const limitRaw = Number(new URL(req.url).searchParams.get("limit") || "25");
  const batchSize = Number.isFinite(limitRaw)
    ? Math.min(100, Math.max(1, Math.trunc(limitRaw)))
    : 25;

  const result = await runNotificationWorker({ batchSize });
  return NextResponse.json({ ok: true, ...result });
}
