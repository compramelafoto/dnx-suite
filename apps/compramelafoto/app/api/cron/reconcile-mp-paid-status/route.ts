/**
 * Reconciliación PAID (álbum) + PAID_HELD (precompra) + entitlements vs cancelación.
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *     "https://tu-dominio.com/api/cron/reconcile-mp-paid-status?days=30"
 *
 * Query: days (1–365, default 30), dryRun=1, maxAlbumOrders, maxPreCompraOrders, maxEntitlements
 * Órdenes PAID: filtro por Order.updatedAt >= now - days (ver migración order_updatedAt).
 */

import { NextRequest, NextResponse } from "next/server";
import { assertCronAuth } from "@/lib/cron-auth";
import { reconcileMercadoPagoPaidAndPreCompra } from "@/lib/reconcile-mp-paid-and-precompra";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
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
    const maxAlbumOrders = parseIntParam(searchParams.get("maxAlbumOrders"), 400, 1, 2000);
    const maxPreCompraOrders = parseIntParam(searchParams.get("maxPreCompraOrders"), 400, 1, 2000);
    const maxEntitlements = parseIntParam(searchParams.get("maxEntitlements"), 500, 1, 3000);
    const dryRun =
      searchParams.get("dryRun") === "1" || searchParams.get("dryRun")?.toLowerCase() === "true";

    const result = await reconcileMercadoPagoPaidAndPreCompra({
      daysBack,
      maxAlbumOrders,
      maxPreCompraOrders,
      maxEntitlements,
      dryRun,
    });

    return NextResponse.json({
      ok: true,
      message: dryRun
        ? "Simulación: no se modificaron entitlements ni reversión masiva (salvo lecturas MP)."
        : "Reconciliación PAID/precompra ejecutada.",
      ...result,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[reconcile-mp-paid-status]", err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const unauthorized = assertCronAuth(req);
  if (unauthorized) return unauthorized;
  return GET(req);
}
