import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { createMercadoPagoCheckoutProLiveAdapter } from "@repo/payments/mercado-pago";
import { resolveWorkspaceCollector } from "@/lib/payments/connect/collector";
import { sanitizeError } from "@/lib/payments/connect/log";
import { extractPaymentId } from "@/lib/bookings/webhook-payload";
import { acreditarPagoMp } from "@/lib/pedidos/mp";
import { cuotaDeReferencia } from "@/lib/pedidos/mp-puro";

export const dynamic = "force-dynamic";

/**
 * Aviso de Mercado Pago sobre el pago de una cuota de un pedido (etapa 3, Entrega B2). Mismo
 * esquema que el de la tienda, y aparte de él, del de reservas y del de cuotas de socios: un error
 * acá no puede romper otros cobros.
 *
 * **Siempre responde 200**, incluso cuando no puede aplicarlo: un error hace que Mercado Pago
 * reintente durante días y casi nunca se arregla reintentando.
 *
 * **No se confía en el cuerpo del aviso**: trae un identificador y nada más. El estado y a qué
 * cuota corresponde se le preguntan a Mercado Pago con el token de la organización, y la cuota
 * tiene que ser de la organización cuyo token leyó el pago. Ignora todo pago cuya referencia no
 * empiece con `fo-pedcuota:`.
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
    const yaPago = await prisma.fotofficeCobro.findFirst({ where: { providerPaymentRef: providerPaymentId }, select: { id: true } });
    if (yaPago) return NextResponse.json({ ok: true, applied: false, motivo: "aviso repetido" });

    // Para leer el pago hace falta el token de alguna organización: se prueba con las que tienen
    // pedidos en marcha (confirmados o en curso).
    const candidatas = await prisma.fotofficePedido.findMany({
      where: { status: { in: ["CONFIRMADO", "EN_CURSO"] } },
      select: { workspaceId: true },
      distinct: ["workspaceId"],
      orderBy: { updatedAt: "desc" },
      take: 20,
    });
    if (candidatas.length === 0) return NextResponse.json({ ok: true, applied: false, motivo: "sin pedidos en marcha" });

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

      if (!cuotaDeReferencia(pago.externalReference)) {
        // Es un pago de otra cosa —la tienda, una reserva, una cuota de socio—: no es de este aviso.
        return NextResponse.json({ ok: true, applied: false, motivo: "no es de un pedido" });
      }

      const r = await acreditarPagoMp(workspaceId, pago);
      return NextResponse.json({ ok: true, applied: r.resultado === "acreditado", resultado: r.resultado });
    }

    return NextResponse.json({ ok: true, applied: false, motivo: "no se pudo resolver el pago" });
  } catch (error) {
    console.error("[fotoffice][pedidos] falló el aviso de MercadoPago", { providerPaymentId, detalle: sanitizeError(error) });
    return NextResponse.json({ ok: false, error: "no se pudo aplicar" }, { status: 200 });
  }
}

/** Mercado Pago también avisa por GET en algunas configuraciones. Mismo camino. */
export async function GET(request: Request) {
  return POST(request);
}
