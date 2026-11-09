import { NextRequest, NextResponse, after } from "next/server";
import { avisarAMuestras } from "@/lib/dnx-payments/aviso-muestras";
import { handleClfOrdersWebhook } from "@/lib/homologation/mp-split-1n/orders-webhook";
import { intentarWebhookPiloto } from "@/lib/split-1n-piloto/webhook";

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

  // Piloto Split 1:N en el cobro de álbumes de CLF. Sólo toma las órdenes cuya referencia es
  // de un pedido del piloto; todo lo demás sigue por el receptor de siempre.
  const piloto = await intentarWebhookPiloto({
    dataId: url.searchParams.get("data.id"),
    type: url.searchParams.get("type") ?? url.searchParams.get("topic"),
  });
  if (piloto.manejado && piloto.reintentar) {
    // Carrito de evento cobrado que no se pudo confirmar: error para que Mercado Pago reintente.
    return NextResponse.json({ ok: false, piloto: true, resultado: piloto.resultado }, { status: 503 });
  }
  if (piloto.manejado) {
    return NextResponse.json({ ok: true, piloto: true, resultado: piloto.resultado }, { status: 200 });
  }

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
