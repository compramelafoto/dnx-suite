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
  // Cada paso por separado: si falla el aviso de inventario, la retención corre igual.
  let inventario: { found: number; notified: number } | null = null;
  let held: number | null = null;
  try {
    inventario = await notifyNewInventoryMatches();
  } catch (err) {
    console.error("[cruce-inventario] falló el aviso de inventario", err);
  }
  try {
    held = (await holdListingsWithActiveReports()).held;
  } catch (err) {
    console.error("[cruce-inventario] falló la retención de publicaciones", err);
  }
  if (!inventario || held === null) {
    return NextResponse.json(
      {
        ok: false,
        error: "cruce_failed",
        ...(inventario ?? {}),
        ...(held !== null ? { held } : {}),
      },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, ...inventario, held });
}
