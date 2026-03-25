import { NextRequest, NextResponse } from "next/server";
import { processEmailQueue } from "@/lib/email-sender";
import { assertCronAuth } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/cron/process-email-queue
 *
 * Procesa emails pendientes de la cola
 * Protegido: si CRON_SECRET está definido, el request debe enviar
 *   Authorization: Bearer <CRON_SECRET>
 */
export async function GET(req: NextRequest) {
  const unauthorized = assertCronAuth(req);
  if (unauthorized) return unauthorized;

  try {
    const results = await processEmailQueue(10); // Procesar hasta 10 emails

    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
    });
  } catch (error: any) {
    console.error("Error procesando cola de emails:", error);
    return NextResponse.json(
      { error: "Error procesando cola de emails", detail: error.message },
      { status: 500 }
    );
  }
}
