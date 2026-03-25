/**
 * Endpoint para regenerar ZIPs y reenviar emails de descarga
 * a todos los pedidos PAID de las últimas 48h con ítems digitales.
 *
 * Protegido por CRON_SECRET. Ejecutar manualmente cuando sea necesario:
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *     "https://tu-dominio.com/api/cron/regenerate-zips-last-48h"
 */

import { NextRequest, NextResponse } from "next/server";
import { assertCronAuth } from "@/lib/cron-auth";
import { regenerateOrderZipsLastNHours } from "@/lib/regenerate-order-zips";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const unauthorized = assertCronAuth(req);
  if (unauthorized) return unauthorized;

  try {
    const result = await regenerateOrderZipsLastNHours(48, true);

    return NextResponse.json({
      ok: true,
      message:
        "Regeneración completada. ZIPs generados y emails reenviados a clientes.",
      ...result,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[regenerate-zips-last-48h]", err);
    return NextResponse.json(
      { ok: false, error: msg },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const unauthorized = assertCronAuth(req);
  if (unauthorized) return unauthorized;

  return GET(req);
}
