import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { createMercadoPagoCheckoutProLiveAdapter } from "@repo/payments/mercado-pago";
import { resolveWorkspaceCollector } from "@/lib/payments/connect/collector";
import { sanitizeError } from "@/lib/payments/connect/log";
import { extractPaymentId } from "@/lib/bookings/webhook-payload";
import { acreditarPagoGaleria } from "@/lib/galerias/acreditar";
import { compraDeReferencia } from "@/lib/galerias/venta-publica";

export const dynamic = "force-dynamic";

/**
 * Aviso de Mercado Pago sobre el pago de unas fotos extra de una galería (etapa 7, Entrega A2). Mismo esquema
 * que el de las cuotas de pedidos, y aparte de él, del de la tienda y del de reservas: un error acá no puede
 * romper otros cobros.
 *
 * **Siempre responde 200**, incluso cuando no puede aplicarlo: un error hace que Mercado Pago reintente durante
 * días y casi nunca se arregla reintentando.
 *
 * **No se confía en el cuerpo del aviso**: trae un identificador y nada más. El estado y a qué compra
 * corresponde se le preguntan a Mercado Pago con el token de la organización, y la compra tiene que ser de la
 * organización cuyo token leyó el pago. Ignora todo pago cuya referencia no empiece con `fo-galcompra:`.
 */
export async function POST(request: Request) {
  let providerPaymentId: string | null = null;
  try {
    const url = new URL(request.url);
    const cuerpo = await request.json().catch(() => null);
    providerPaymentId = extractPaymentId(cuerpo, url);
    if (!providerPaymentId) {
      return NextResponse.json({ ignored: "sin identificador de pago" }, { status: 200 });
    }
    // Ya acreditado: no hace falta volver a preguntarle a Mercado Pago.
    const yaPago = await prisma.fotofficeGaleriaCompra.findFirst({ where: { providerPaymentRef: providerPaymentId }, select: { id: true } });
    if (yaPago) return NextResponse.json({ ok: true, applied: false, motivo: "aviso repetido" });

    // Para leer el pago hace falta el token de alguna organización: se prueba con las que tienen compras sin
    // pagar (pendientes o canceladas que igual pueden llegar a pagarse) o ya pagas (un segundo pago por la misma
    // compra se registra y se avisa, sin tocar Caja).
    const candidatas = await prisma.fotofficeGaleriaCompra.findMany({
      where: { status: { in: ["PENDIENTE", "CANCELADA", "PAGADA"] } },
      select: { workspaceId: true },
      distinct: ["workspaceId"],
      orderBy: { updatedAt: "desc" },
      take: 20,
    });
    if (candidatas.length === 0) return NextResponse.json({ ok: true, applied: false, motivo: "sin compras pendientes" });

    for (const { workspaceId } of candidatas) {
      const collector = await resolveWorkspaceCollector(workspaceId);
      if (!collector.ok) continue;

      // El adaptador lee el pago con el token con el que se lo construye: uno por organización.
      const adapter = createMercadoPagoCheckoutProLiveAdapter({ accessToken: collector.collector.accessToken });
      let pago;
      try {
        pago = await adapter.getPayment(providerPaymentId);
      } catch {
        // Ese pago no es de esta organización, o su token no alcanza: se prueba con la siguiente.
        continue;
      }

      if (!compraDeReferencia(pago.externalReference)) {
        // Es un pago de otra cosa —un pedido, la tienda, una reserva—: no es de este aviso.
        return NextResponse.json({ ok: true, applied: false, motivo: "no es de una galería" });
      }

      const r = await acreditarPagoGaleria(workspaceId, pago);
      return NextResponse.json({ ok: true, applied: r.resultado === "acreditado", resultado: r.resultado });
    }

    return NextResponse.json({ ok: true, applied: false, motivo: "no se pudo resolver el pago" });
  } catch (error) {
    console.error("[galerias] falló el aviso de MercadoPago", { providerPaymentId, detalle: sanitizeError(error) });
    return NextResponse.json({ ok: false, error: "no se pudo aplicar" }, { status: 200 });
  }
}

/** Mercado Pago también avisa por GET en algunas configuraciones. Mismo camino. */
export async function GET(request: Request) {
  return POST(request);
}
