/**
 * Cron diario: cruza las denuncias de equipos robados contra el historial de números
 * de serie y avisa al administrador por correo si aparece algo nuevo.
 * Auth: Bearer CRON_SECRET (o x-cron-secret).
 */
import { NextRequest, NextResponse } from "next/server";
import { notifyAdminOfNewStolenGearMatches, scanStolenGear } from "@/lib/stolen-gear/scan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function authorize(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = req.headers.get("authorization") || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const alt = req.headers.get("x-cron-secret")?.trim() || "";
  return bearer === secret || alt === secret;
}

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET?.trim()) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET not configured" }, { status: 503 });
  }
  if (!authorize(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  try {
    const scan = await scanStolenGear();
    const notice = await notifyAdminOfNewStolenGearMatches();
    return NextResponse.json({ ok: true, ...scan, ...notice });
  } catch (err) {
    console.error("[stolen-gear-scan] error", err);
    return NextResponse.json({ ok: false, error: "scan_failed" }, { status: 500 });
  }
}
