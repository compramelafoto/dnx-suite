/**
 * Cron: genera y envía el Informe Diario DNX.
 * Se ejecuta a las 03:00 UTC = 00:00 de Argentina.
 * Auth: Bearer CRON_SECRET (o x-cron-secret).
 */
import { NextRequest, NextResponse } from "next/server";

import { runDailyReport } from "@/lib/daily-report/run-daily-report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorize(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = req.headers.get("authorization") || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const alt = req.headers.get("x-cron-secret")?.trim() || "";
  return bearer === secret || alt === secret;
}

function isEnabled(): boolean {
  return process.env.DAILY_REPORT_ENABLED !== "false";
}

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET?.trim()) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET not configured" },
      { status: 503 },
    );
  }

  if (!authorize(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  if (!isEnabled()) {
    return NextResponse.json(
      { ok: true, paused: true, reason: "DAILY_REPORT_ENABLED=false" },
      { status: 200 },
    );
  }

  try {
    const result = await runDailyReport({ now: new Date() });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error desconocido.",
      },
      { status: 500 },
    );
  }
}
