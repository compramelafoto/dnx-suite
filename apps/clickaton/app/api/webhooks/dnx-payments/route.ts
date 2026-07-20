import { NextResponse } from "next/server";
import { getCheckoutService } from "@/lib/checkout/actions/runtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Adapter temporal de entrada HTTP.
 *
 * Arquitectura objetivo:
 *   Proveedor → endpoint DNX Payments → inbox → normalización → efecto Clickatón
 *
 * Hoy no hay host HTTP productivo separado de DNX Payments: esta ruta
 * verifica la firma y delega inmediatamente a `CheckoutService`
 * (cliente tipado → `createClickatonCheckoutService` + efectos de inscripción).
 * No contiene lógica comercial de Clickatón ni parser MP crudo.
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
