import { NextResponse } from "next/server";
import { getCheckoutService } from "@/lib/checkout/actions/runtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Webhook de eventos ya normalizados por DNX Payments.
 * No recibe payloads crudos de Mercado Pago ni confirma por query params.
 *
 * Headers:
 * - x-dnx-payments-signature: HMAC-SHA256 hex del body (DNX_PAYMENTS_WEBHOOK_SECRET)
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const headers: Record<string, string | undefined> = {
    "x-dnx-payments-signature":
      request.headers.get("x-dnx-payments-signature") ?? undefined,
  };

  const service = getCheckoutService();
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
    });
  } catch {
    return NextResponse.json({ ok: false, code: "UNEXPECTED" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: false, code: "METHOD_NOT_ALLOWED" }, { status: 405 });
}
