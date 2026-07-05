/**
 * Activa comisiones de organizador de evento: PENDING → AVAILABLE cuando `availableAt <= now`.
 *
 * Protegido con el mismo patrón que otros crons (`lib/cron-auth.ts`):
 *   Authorization: Bearer <CRON_SECRET>
 *
 * Manual:
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
 *     "https://tu-dominio.com/api/internal/event-organizer-commissions/mark-available"
 *
 * Vercel Cron invoca GET por defecto; esta ruta acepta GET y POST con la misma lógica.
 */

import { NextRequest, NextResponse } from "next/server";
import { assertCronAuth } from "@/lib/cron-auth";
import { markDueEventOrganizerCommissionsAsAvailable } from "@/lib/event-organizer-commission-availability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(req: NextRequest) {
  const unauthorized = assertCronAuth(req);
  if (unauthorized) return unauthorized;

  try {
    const updatedCount = await markDueEventOrganizerCommissionsAsAvailable();
    return NextResponse.json({ ok: true, updatedCount });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[event-organizer-commissions/mark-available]", err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return handle(req);
}

export async function GET(req: NextRequest) {
  return handle(req);
}
