/**
 * Webhook de pagos de FotoRank (Mercado Pago, Checkout Pro).
 *
 * Endpoint público: la única defensa es la verificación de firma, que ocurre
 * dentro de `processPaymentWebhook`. Esta ruta sólo traduce HTTP.
 *
 * Se responde 200 en los casos que no requieren reintento (duplicado, tipo
 * ignorado, pendiente) para que Mercado Pago no reintente sin necesidad.
 */
import { NextResponse } from "next/server";

import { processPaymentWebhook } from "../../../../lib/fotorank/checkout/webhook-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);

  type WebhookBody = { data?: { id?: string }; id?: string | number; type?: string };
  let body: WebhookBody | null = null;
  try {
    body = (await request.json()) as WebhookBody;
  } catch {
    body = null;
  }

  const dataId =
    url.searchParams.get("data.id") ??
    url.searchParams.get("id") ??
    body?.data?.id ??
    (body?.id ? String(body.id) : null);

  const type = url.searchParams.get("type") ?? url.searchParams.get("topic") ?? body?.type ?? null;

  try {
    const result = await processPaymentWebhook({
      headers: {
        signature: request.headers.get("x-signature"),
        requestId: request.headers.get("x-request-id"),
      },
      dataId,
      type,
    });

    return NextResponse.json(
      {
        ok: result.ok,
        code: result.code,
        ...(result.applied !== undefined ? { applied: result.applied } : {}),
        ...(result.duplicate ? { duplicate: true } : {}),
      },
      { status: result.httpStatus },
    );
  } catch {
    // Un error inesperado devuelve 500 para que Mercado Pago reintente.
    return NextResponse.json({ ok: false, code: "UNEXPECTED" }, { status: 500 });
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ ok: false, code: "METHOD_NOT_ALLOWED" }, { status: 405 });
}
