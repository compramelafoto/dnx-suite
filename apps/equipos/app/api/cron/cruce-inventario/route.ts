import { NextRequest, NextResponse } from "next/server";
import { notifyNewInventoryMatches } from "@/lib/inventario/denuncias";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Cron diario: cruza denuncias activas con los inventarios y avisa al admin sólo lo nuevo. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET not configured" }, { status: 503 });
  }
  const header = req.headers.get("authorization") || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (bearer !== secret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  try {
    const r = await notifyNewInventoryMatches();
    return NextResponse.json({ ok: true, ...r });
  } catch (err) {
    console.error("[cruce-inventario] error", err);
    return NextResponse.json({ ok: false, error: "cruce_failed" }, { status: 500 });
  }
}
