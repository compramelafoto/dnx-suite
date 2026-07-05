/**
 * Reconcilia pedidos de álbum en PENDING o FAILED con Mercado Pago (últimos N días):
 * si MP tiene un pago approved con external_reference = order id, aplica el mismo
 * cierre que el webhook (entrega digital, emails, etc.).
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *     "https://tu-dominio.com/api/cron/reconcile-mp-pending-orders?days=30"
 *
 * Query: days (1–365, default 30), dryRun=1, maxOrders (default 500)
 *
 * Vercel Cron (vercel.json): diario 06:00 UTC con ?days=7. Con CRON_SECRET en el proyecto,
 * Vercel envía Authorization: Bearer automáticamente.
 */

import { NextRequest, NextResponse } from "next/server";
import { assertCronAuth } from "@/lib/cron-auth";
import { reconcilePendingAlbumOrdersMercadoPago } from "@/lib/reconcile-mp-pending-album-orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Muchas llamadas a la API de MP por pedido pendiente */
export const maxDuration = 300;

function parseIntParam(v: string | null, fallback: number, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

export async function GET(req: NextRequest) {
  const unauthorized = assertCronAuth(req);
  if (unauthorized) return unauthorized;

  try {
    const { searchParams } = new URL(req.url);
    const daysBack = parseIntParam(searchParams.get("days"), 30, 1, 365);
    const maxOrders = parseIntParam(searchParams.get("maxOrders"), 500, 1, 2000);
    const dryRun =
      searchParams.get("dryRun") === "1" || searchParams.get("dryRun")?.toLowerCase() === "true";

    const result = await reconcilePendingAlbumOrdersMercadoPago({
      daysBack,
      maxOrders,
      dryRun,
    });

    return NextResponse.json({
      ok: true,
      message: dryRun
        ? "Simulación: no se modificó ningún pedido."
        : "Reconciliación ejecutada. Revisá applied y errors.",
      ...result,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[reconcile-mp-pending-orders]", err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const unauthorized = assertCronAuth(req);
  if (unauthorized) return unauthorized;
  return GET(req);
}
