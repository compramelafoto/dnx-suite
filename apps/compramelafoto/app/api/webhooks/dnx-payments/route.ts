import { NextRequest, NextResponse, after } from "next/server";
import { avisarAMuestras } from "@/lib/dnx-payments/aviso-muestras";
import { handleClfOrdersWebhook } from "@/lib/homologation/mp-split-1n/orders-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Webhook `order` de Mercado Pago — homologación Orders API + Split (1 a N).
 *
 * Sólo delega en DNX Payments: no hay lógica de negocio acá, y esta superficie
 * no produce ningún efecto (observe + reconcile). El Checkout Pro productivo de
 * Comprame la Foto vive en `/api/payments/mp/webhook` y no se toca.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const url = request.nextUrl;

  const result = await handleClfOrdersWebhook({
    headers: {
      "x-signature": request.headers.get("x-signature") ?? undefined,
      "x-request-id": request.headers.get("x-request-id") ?? undefined,
    },
    rawBody,
    queryDataId: url.searchParams.get("data.id"),
    queryType: url.searchParams.get("type") ?? url.searchParams.get("topic"),
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, code: result.code },
      { status: result.status },
    );
  }

  // Venta de obras de Muestras: se le avisa en segundo plano, después de responder. El aviso nunca
  // cambia esta respuesta ni lo que procesa CLF (`avisarAMuestras` no lanza).
  if (result.routeTo === "muestras") {
    const providerOrderId = result.providerOrderId;
    after(() => avisarAMuestras(providerOrderId));
  }

  return NextResponse.json({ ok: true, ...result.evidence }, { status: 200 });
}

export async function GET() {
  return NextResponse.json(
    { ok: false, code: "METHOD_NOT_ALLOWED" },
    { status: 405 },
  );
}
