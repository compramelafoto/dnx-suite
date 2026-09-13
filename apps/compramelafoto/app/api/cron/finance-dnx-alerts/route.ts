/**
 * Cron: aviso diario de Finanzas DNX.
 * Se ejecuta a las 11:00 UTC = 08:00 de Argentina.
 * Manda un correo sólo si hay facturas vencidas e impagas, o proveedores
 * activos sin el gasto del mes cargado (desde el día 5). Si no hay nada que
 * avisar, no manda nada: silencio significa que todo está en orden.
 * Auth: Bearer CRON_SECRET (ver `assertCronAuth`).
 */
import { NextRequest, NextResponse } from "next/server";

import { assertCronAuth } from "@/lib/cron-auth";
import { runFinanceDnxAlerts } from "@/lib/finance-dnx/run-finance-dnx-alerts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const unauthorized = assertCronAuth(req);
  if (unauthorized) return unauthorized;

  try {
    const result = await runFinanceDnxAlerts({ now: new Date() });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[cron:finance-dnx-alerts]", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error desconocido.",
      },
      { status: 500 },
    );
  }
}
