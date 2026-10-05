import { handleMercadoPagoWebhook } from "@/lib/payments/mp/webhook-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Aviso de Mercado Pago de los cobros de reservas. La dirección se conserva porque las
 * preferencias ya creadas apuntan acá; el procesamiento es el mismo para todos los cobros
 * (ver `lib/payments/mp/webhook-handler.ts`).
 */
export async function POST(request: Request) {
  return handleMercadoPagoWebhook(request, "reservas");
}

/** Mercado Pago también avisa por GET en algunas configuraciones. Mismo camino. */
export async function GET(request: Request) {
  return POST(request);
}
