import { NextRequest, NextResponse } from "next/server";
import { notifyNewInventoryMatches } from "@/lib/inventario/denuncias";
import { holdListingsWithActiveReports } from "@/lib/publicaciones/moderacion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Cron diario: cruza denuncias activas con los inventarios y avisa al admin sólo lo nuevo
 * y pasa a revisión las publicaciones cuya serie tiene una denuncia activa. */
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
    const { held } = await holdListingsWithActiveReports();
    return NextResponse.json({ ok: true, ...r, held });
  } catch (err) {
    console.error("[cruce-inventario] error", err);
    return NextResponse.json({ ok: false, error: "cruce_failed" }, { status: 500 });
  }
}
