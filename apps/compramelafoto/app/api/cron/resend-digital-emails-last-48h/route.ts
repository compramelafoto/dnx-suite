/**
 * Reenvía emails de descarga digital a clientes de pedidos PAID
 * de las últimas 48 horas que tienen ítems digitales.
 *
 * Protegido por CRON_SECRET.
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *     "https://tu-dominio.com/api/cron/resend-digital-emails-last-48h"
 */

import { NextRequest, NextResponse } from "next/server";
import { assertCronAuth } from "@/lib/cron-auth";
import { resendDigitalDownloadEmailsLastNHours } from "@/lib/resend-digital-emails";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const unauthorized = assertCronAuth(req);
  if (unauthorized) return unauthorized;

  try {
    const result = await resendDigitalDownloadEmailsLastNHours(48);

    return NextResponse.json({
      ok: true,
      message: "Emails encolados. El cron process-email-queue los enviará en los próximos minutos.",
      ...result,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[resend-digital-emails-last-48h]", err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const unauthorized = assertCronAuth(req);
  if (unauthorized) return unauthorized;
  return GET(req);
}
