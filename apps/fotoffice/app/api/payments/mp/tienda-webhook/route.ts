import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { createMercadoPagoCheckoutProLiveAdapter } from "@repo/payments/mercado-pago";
import { resolveWorkspaceCollector } from "@/lib/payments/connect/collector";
import { sanitizeError } from "@/lib/payments/connect/log";
import { extractPaymentId } from "@/lib/bookings/webhook-payload";
import { creditStorePayment } from "@/lib/store/credit-payment";
import { parseStoreExternalReference } from "@/lib/store/external-reference";
import { isApprovedMpPayment } from "@/lib/store/mp-payment";

export const dynamic = "force-dynamic";

const VENTANA_MS = 48 * 60 * 60 * 1000;

/**
 * Aviso de Mercado Pago sobre el pago de un pedido de la tienda. Copia estructural del de
 * reservas, y aparte de él y del de cuotas por lo mismo: un error de la tienda no puede romper
 * otros cobros.
 *
 * **Siempre responde 200**, incluso cuando no puede aplicarlo: un error hace que Mercado Pago
 * reintente durante días, y el problema casi nunca se arregla reintentando. Lo que no llega por
 * acá lo encuentra la conciliación del cron (`/api/cron/tienda`).
 *
 * **No se confía en el cuerpo del aviso**: trae un identificador y nada más. El estado y a qué
 * pedido corresponde se le preguntan a Mercado Pago con el token de la institución.
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
    const yaPago = await prisma.storeOrder.findFirst({
      where: { mpPaymentId: providerPaymentId },
      select: { id: true },
    });
    if (yaPago) {
      return NextResponse.json({ ok: true, applied: false, motivo: "aviso repetido" });
    }

    // Para leer el pago hace falta el token de alguna institución. Se prueba con las que tienen
    // pedidos movidos en las últimas 48 h: esperando el pago, vencidos o cancelados (un pago
    // tardío) y pagados (un segundo pago del mismo pedido, que hay que detectar para devolverlo).
    const desde = new Date(Date.now() - VENTANA_MS);
    const candidatas = await prisma.storeOrder.findMany({
      where: {
        status: { in: ["PENDING_PAYMENT", "EXPIRED", "CANCELLED", "PAID"] },
        updatedAt: { gte: desde },
      },
      select: { workspaceId: true },
      distinct: ["workspaceId"],
      orderBy: { updatedAt: "desc" },
      take: 20,
    });
    if (candidatas.length === 0) {
      return NextResponse.json({ ok: true, applied: false, motivo: "sin pedidos recientes" });
    }

    for (const { workspaceId } of candidatas) {
      const collector = await resolveWorkspaceCollector(workspaceId);
      if (!collector.ok) continue;

      // El adaptador lee el pago con el token con el que se lo construye: uno por institución.
      const adapter = createMercadoPagoCheckoutProLiveAdapter({ accessToken: collector.collector.accessToken });
      let pago;
      try {
        pago = await adapter.getPayment(providerPaymentId);
      } catch {
        // Ese pago no es de esta institución, o su token no alcanza: se prueba con la siguiente.
        continue;
      }

      const orderId = parseStoreExternalReference(pago.externalReference);
      if (!orderId) {
        // Es un pago de otra cosa —una cuota, una reserva—: no es de este webhook.
        return NextResponse.json({ ok: true, applied: false, motivo: "no es de la tienda" });
      }

      // El pago se leyó con el token de ESTA institución: el pedido tiene que ser suyo.
      const propio = await prisma.storeOrder.findFirst({
        where: { id: orderId, workspaceId },
        select: { id: true },
      });
      if (!propio) {
        console.warn("[fotoffice][tienda] aviso de un pago cuyo pedido no es de la institución que lo cobró", {
          workspaceId,
          providerPaymentId,
        });
        return NextResponse.json({ ok: true, applied: false, motivo: "el pedido no es de esta institución" });
      }

      if (!isApprovedMpPayment(pago)) {
        return NextResponse.json({ ok: true, applied: false, motivo: "pago no aprobado" });
      }

      const r = await creditStorePayment({ orderId, providerPaymentId: pago.providerPaymentId || providerPaymentId });
      return NextResponse.json({ ok: true, ...r });
    }

    return NextResponse.json({ ok: true, applied: false, motivo: "no se pudo resolver el pago" });
  } catch (error) {
    console.error("[fotoffice][tienda] falló el aviso de MercadoPago", {
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
