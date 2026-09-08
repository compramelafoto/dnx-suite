import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { createMercadoPagoCheckoutProLiveAdapter } from "@repo/payments/mercado-pago";
import { resolveWorkspaceCollector } from "@/lib/payments/connect/collector";
import { sanitizeError } from "@/lib/payments/connect/log";
import { extractPaymentId } from "@/lib/bookings/webhook-payload";
import { creditBookingPayment, parseBookingExternalReference } from "@/lib/bookings/checkout";

export const dynamic = "force-dynamic";

/**
 * Aviso de Mercado Pago sobre el pago de una reserva.
 *
 * **Siempre responde 200**, incluso cuando no puede aplicarlo. Devolver un error hace que
 * Mercado Pago reintente durante días, y el problema casi nunca se arregla reintentando:
 * lo que hay es un registro con el motivo.
 *
 * **No se confía en el cuerpo del aviso**: trae un identificador y nada más. El estado y a
 * qué reserva corresponde se le preguntan a Mercado Pago con el token de la institución. Un
 * cuerpo falsificado no puede acreditar un pago que no existe.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const cuerpo = await request.json().catch(() => null);
  const providerPaymentId = extractPaymentId(cuerpo, url);
  if (!providerPaymentId) {
    return NextResponse.json({ ignored: "sin identificador de pago" }, { status: 200 });
  }

  try {
    // Ya acreditado: no hace falta volver a preguntarle a Mercado Pago.
    const yaPago = await prisma.booking.findFirst({
      where: { mpPaymentId: providerPaymentId },
      select: { paymentStatus: true },
    });
    if (yaPago?.paymentStatus === "PAID") {
      return NextResponse.json({ ok: true, applied: false, motivo: "aviso repetido" });
    }

    // Para consultar el pago hace falta el token de alguna institución. Se resuelve por las
    // reservas que están esperando pago: son las únicas que pueden corresponder a este aviso.
    const esperando = await prisma.booking.findMany({
      where: { status: "HOLD", paymentStatus: "PENDING" },
      select: { workspaceId: true },
      distinct: ["workspaceId"],
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    if (esperando.length === 0) {
      return NextResponse.json({ ok: true, applied: false, motivo: "sin reservas esperando pago" });
    }

    for (const { workspaceId } of esperando) {
      const collector = await resolveWorkspaceCollector(workspaceId);
      if (!collector.ok) continue;

      // El adaptador lee el pago con el token con el que se lo construye: por eso se arma
      // uno por institución en vez de reutilizar el mismo.
      const adapter = createMercadoPagoCheckoutProLiveAdapter({
        accessToken: collector.collector.accessToken,
      });
      let pago;
      try {
        pago = await adapter.getPayment(providerPaymentId);
      } catch {
        // Ese pago no es de esta institución, o su token no alcanza. Se prueba con la
        // siguiente en vez de dar el aviso por perdido.
        continue;
      }

      const bookingId = parseBookingExternalReference(pago.externalReference);
      if (!bookingId) {
        // Es un pago de otra cosa —una cuota, un curso—: no es de este webhook.
        return NextResponse.json({ ok: true, applied: false, motivo: "no es una reserva" });
      }

      const estado = String(
        (pago.rawSanitized as Record<string, unknown>).status ?? pago.status,
      );
      if (estado !== "approved") {
        return NextResponse.json({ ok: true, applied: false, motivo: `estado ${estado}` });
      }

      const r = await creditBookingPayment({ bookingId, providerPaymentId });
      return NextResponse.json({ ok: true, ...r });
    }

    return NextResponse.json({ ok: true, applied: false, motivo: "no se pudo resolver el pago" });
  } catch (error) {
    console.error("[fotoffice][reservas] falló el aviso de MercadoPago", {
      providerPaymentId,
      detalle: sanitizeError(error),
    });
    return NextResponse.json({ ok: false, error: "no se pudo aplicar" }, { status: 200 });
  }
}

/** Mercado Pago también avisa por GET en algunas configuraciones. Mismo camino. */
export async function GET(request: Request) {
  return POST(request);
}
