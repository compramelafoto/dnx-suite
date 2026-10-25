import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { createMercadoPagoCheckoutProLiveAdapter } from "@repo/payments/mercado-pago";
import { resolveWorkspaceCollector } from "@/lib/payments/connect/collector";
import { sanitizeError } from "@/lib/payments/connect/log";
import { extractPaymentId } from "@/lib/bookings/webhook-payload";
import { acreditarPagoMp, avisarDevolucionMp } from "@/lib/pedidos/mp";
import { cuotaDeReferencia } from "@/lib/pedidos/mp-puro";

export const dynamic = "force-dynamic";

/** Cuántas organizaciones se prueban, como mucho, para leer un pago de una preferencia vieja (sin `?ws=`). */
const MAX_ORGANIZACIONES_A_PROBAR = 20;

/** Forma de id de workspace (cuid): lo demás se descarta antes de usarlo. */
const wsValido = (v: string | null): v is string => typeof v === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(v);

type Pago = Awaited<ReturnType<ReturnType<typeof createMercadoPagoCheckoutProLiveAdapter>["getPayment"]>>;

/** Lee el pago con el token de la organización. null si no tiene cobros o su token no puede leerlo (no es suyo). */
async function leerPago(workspaceId: string, providerPaymentId: string): Promise<Pago | null> {
  const collector = await resolveWorkspaceCollector(workspaceId);
  if (!collector.ok) return null;
  // El adaptador lee el pago con el token con el que se lo construye: uno por organización.
  const adapter = createMercadoPagoCheckoutProLiveAdapter({ accessToken: collector.collector.accessToken });
  try {
    return await adapter.getPayment(providerPaymentId);
  } catch {
    return null;
  }
}

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
 *
 * Qué organización (B2-3): las preferencias nuevas mandan `?ws=<workspaceId>`; el pago se lee SÓLO con
 * ese token (si no puede leerlo, el aviso se descarta: `ws` solo no alcanza). Las viejas, sin `ws`, prueban
 * los tokens de las organizaciones con pedidos (también completados o cancelados), las de actividad más
 * reciente primero, hasta `MAX_ORGANIZACIONES_A_PROBAR`.
 *
 * Un pago ya acreditado (B2-4) se vuelve a leer con el token de su organización: si Mercado Pago lo
 * devolvió o hubo contracargo, queda el aviso al estudio (una vez por pago y estado), sin tocar Caja.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const cuerpo = await request.json().catch(() => null);
  const providerPaymentId = extractPaymentId(cuerpo, url);
  if (!providerPaymentId) {
    return NextResponse.json({ ignored: "sin identificador de pago" }, { status: 200 });
  }

  try {
    // Ya acreditado: se mira si Mercado Pago lo dio vuelta (devolución, contracargo); si no, es un aviso repetido.
    const yaPago = await prisma.fotofficeCobro.findFirst({ where: { providerPaymentRef: providerPaymentId }, select: { workspaceId: true } });
    if (yaPago) {
      const pago = await leerPago(yaPago.workspaceId, providerPaymentId);
      const r = pago ? await avisarDevolucionMp(yaPago.workspaceId, pago) : "sigue_aprobado";
      if (r === "avisado" || r === "ya_avisado") return NextResponse.json({ ok: true, applied: false, motivo: "devolución", resultado: r });
      return NextResponse.json({ ok: true, applied: false, motivo: "aviso repetido" });
    }

    const ws = url.searchParams.get("ws");
    if (wsValido(ws)) {
      const pago = await leerPago(ws, providerPaymentId);
      if (!pago) return NextResponse.json({ ok: true, applied: false, motivo: "el pago no es de esa organización" });
      if (!cuotaDeReferencia(pago.externalReference)) return NextResponse.json({ ok: true, applied: false, motivo: "no es de un pedido" });
      const r = await acreditarPagoMp(ws, pago);
      return NextResponse.json({ ok: true, applied: r.resultado === "acreditado", resultado: r.resultado });
    }

    // Preferencia vieja: se prueba con el token de cada organización con pedidos, las más activas primero.
    const candidatas = await prisma.fotofficePedido.findMany({
      where: { status: { in: ["CONFIRMADO", "EN_CURSO", "COMPLETADO", "CANCELADO"] } },
      select: { workspaceId: true },
      distinct: ["workspaceId"],
      orderBy: { updatedAt: "desc" },
      take: MAX_ORGANIZACIONES_A_PROBAR,
    });
    if (candidatas.length === 0) return NextResponse.json({ ok: true, applied: false, motivo: "sin pedidos" });

    const probadas = new Set<string>();
    for (const { workspaceId } of candidatas) {
      if (probadas.has(workspaceId)) continue;
      probadas.add(workspaceId);
      const pago = await leerPago(workspaceId, providerPaymentId);
      // Ese pago no es de esta organización, o no tiene cobros: se prueba con la siguiente.
      if (!pago) continue;

      if (!cuotaDeReferencia(pago.externalReference)) {
        // Es un pago de otra cosa —la tienda, una reserva, una cuota de socio—: no es de este aviso.
        return NextResponse.json({ ok: true, applied: false, motivo: "no es de un pedido" });
      }

      const r = await acreditarPagoMp(workspaceId, pago);
      return NextResponse.json({ ok: true, applied: r.resultado === "acreditado", resultado: r.resultado });
    }

    console.warn("[fotoffice][pedidos] no se pudo resolver el pago de un aviso", { probadas: probadas.size });
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
