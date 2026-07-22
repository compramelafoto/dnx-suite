import { NextResponse } from "next/server";
import { getCheckoutService } from "@/lib/checkout/actions/runtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Entrada HTTP de notificaciones de pago.
 *
 * Arquitectura:
 *   Proveedor (Mercado Pago Webhooks firmados) → firma x-signature →
 *   S2S getPayment → inbox (origin HTTP_WEBHOOK) → efectos Clickatón
 *
 * También acepta eventos ya normalizados DNX con `x-dnx-payments-signature`
 * (selfchecks / bridge interno). No acepta unsigned. No es IPN.
 *
 * Headers MP:
 * - x-signature: ts=…,v1=… (HMAC-SHA256 del manifest oficial)
 * - x-request-id
 * Query/body: data.id, type=payment
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const url = new URL(request.url);
  const headers: Record<string, string | undefined> = {
    "x-dnx-payments-signature":
      request.headers.get("x-dnx-payments-signature") ?? undefined,
    "x-signature": request.headers.get("x-signature") ?? undefined,
    "x-request-id": request.headers.get("x-request-id") ?? undefined,
  };

  const service = getCheckoutService();

  // Preferir Webhooks firmados de Mercado Pago cuando viene x-signature.
  if (headers["x-signature"]) {
    const mp = await service.ingestMercadoPagoWebhook({
      headers,
      rawBody,
      queryDataId: url.searchParams.get("data.id"),
      queryType: url.searchParams.get("type"),
      queryTopic: url.searchParams.get("topic"),
    });
    if (!mp.ok) {
      const status =
        mp.code === "WEBHOOK_INVALID_SIGNATURE" || mp.code === "LIVE_MODE_FORBIDDEN"
          ? 401
          : mp.code === "WEBHOOK_IGNORED_TYPE"
            ? 200
            : 400;
      if (mp.code === "WEBHOOK_IGNORED_TYPE") {
        return NextResponse.json({ ok: true, ignored: true, code: mp.code });
      }
      return NextResponse.json({ ok: false, code: mp.code }, { status });
    }
    return NextResponse.json({
      ok: true,
      applied: mp.apply.outcome === "applied",
      duplicate: mp.apply.outcome === "duplicate",
      conflict: mp.apply.outcome === "conflict",
      conflictCode: mp.apply.conflictCode ?? null,
      origin: "HTTP_WEBHOOK",
    });
  }

  const verified = service.verifyWebhook(headers, rawBody);
  if (!verified.ok) {
    return NextResponse.json(
      { ok: false, code: verified.code },
      { status: verified.code === "WEBHOOK_INVALID_SIGNATURE" ? 401 : 400 },
    );
  }

  try {
    const result = await service.applyNormalizedEvent(verified.event);
    return NextResponse.json({
      ok: true,
      applied: result.applied,
      duplicate: result.duplicate,
      conflict: result.conflict,
      conflictCode: result.conflictCode ?? null,
      origin: "NORMALIZED",
    });
  } catch {
    return NextResponse.json({ ok: false, code: "UNEXPECTED" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: false, code: "METHOD_NOT_ALLOWED" }, { status: 405 });
}
