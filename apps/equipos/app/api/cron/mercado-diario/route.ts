import { NextRequest, NextResponse } from "next/server";
import { runSearchAlerts } from "@/lib/catalogo/alertas";
import { expirePendingSales } from "@/lib/ventas/ventas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Cron diario del mercado: vence las ventas que el comprador no confirmó a tiempo y manda los
 * avisos de las alertas de búsqueda. Cada trabajo por separado: si falla uno, los otros corren.
 */
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

  const conteos: Record<string, number> = {};
  let fallo = false;

  try {
    conteos.expired = (await expirePendingSales()).expired;
  } catch (err) {
    fallo = true;
    console.error("[mercado-diario] falló el vencimiento de ventas", err);
  }
  try {
    conteos.emails = (await runSearchAlerts()).emails;
  } catch (err) {
    fallo = true;
    console.error("[mercado-diario] fallaron las alertas de búsqueda", err);
  }
  // Task 6 (pedidos «Busco»): sumar acá `runPurchaseRequests` con su propio try/catch.

  if (fallo) {
    return NextResponse.json({ ok: false, error: "mercado_failed", ...conteos }, { status: 500 });
  }
  return NextResponse.json({ ok: true, ...conteos });
}
