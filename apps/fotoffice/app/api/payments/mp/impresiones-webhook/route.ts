import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { createMercadoPagoCheckoutProLiveAdapter } from "@repo/payments/mercado-pago";
import { extractPaymentId } from "@/lib/bookings/webhook-payload";
import { acreditarPagoImpresion } from "@/lib/impresiones/acreditar-servidor";
import { pedidoDeReferencia } from "@/lib/impresiones/pago-servidor";
import { resolveWorkspaceCollector } from "@/lib/payments/connect/collector";
import { sanitizeError } from "@/lib/payments/connect/log";
import { reversoDelPago } from "@/lib/pedidos/mp-puro";

export const dynamic = "force-dynamic";

/** Forma de id de workspace (cuid): lo demás se descarta antes de usarlo. */
const wsValido = (v: string | null): v is string => typeof v === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(v);

type Pago = Awaited<ReturnType<ReturnType<typeof createMercadoPagoCheckoutProLiveAdapter>["getPayment"]>>;

/** Lee el pago con el token del estudio. null si no tiene cobros o su token no puede leerlo (no es suyo). */
async function leerPago(workspaceId: string, providerPaymentId: string): Promise<Pago | null> {
  const collector = await resolveWorkspaceCollector(workspaceId);
  if (!collector.ok) return null;
  const adapter = createMercadoPagoCheckoutProLiveAdapter({ accessToken: collector.collector.accessToken });
  try {
    return await adapter.getPayment(providerPaymentId);
  } catch {
    return null;
  }
}

/**
 * Aviso de Mercado Pago sobre el pago de un pedido de copias impresas. Mismo esquema que el de galerías
 * (`galerias-webhook`), y aparte de él: un error acá no puede romper otros cobros.
 *
 * **Siempre responde 200**, incluso cuando no puede aplicarlo: un error hace que Mercado Pago reintente
 * durante días y casi nunca se arregla reintentando.
 *
 * **No se confía en el cuerpo del aviso**: trae un identificador y nada más. El estado y a qué pedido
 * corresponde se le preguntan a Mercado Pago con el token del estudio de `?ws=` (todas las preferencias de
 * impresión lo mandan; sin él no se hace nada), y el pedido tiene que ser de ese estudio. Ignora todo pago
 * cuya referencia no empiece con `fo-impresion:`.
 *
 * Un pago ya acreditado se vuelve a leer: si Mercado Pago lo devolvió o hubo contracargo, sólo queda en el
 * log (no cambia el pedido ni Caja: lo resuelve una persona).
 */
export async function POST(request: Request) {
  let providerPaymentId: string | null = null;
  try {
    const url = new URL(request.url);
    const cuerpo = await request.json().catch(() => null);
    providerPaymentId = extractPaymentId(cuerpo, url);
    if (!providerPaymentId) return NextResponse.json({ ignored: "sin identificador de pago" }, { status: 200 });

    const yaPago = await prisma.fotofficePrintOrder.findFirst({ where: { providerPaymentRef: providerPaymentId }, select: { workspaceId: true } });
    if (yaPago) {
      const pago = await leerPago(yaPago.workspaceId, providerPaymentId);
      const reverso = pago ? reversoDelPago(pago) : null;
      if (reverso) {
        console.warn("[impresiones] Mercado Pago dio vuelta un pago de un pedido ya pagado", { estado: reverso, providerPaymentId });
        return NextResponse.json({ ok: true, applied: false, motivo: "devolución" });
      }
      return NextResponse.json({ ok: true, applied: false, motivo: "aviso repetido" });
    }

    const ws = url.searchParams.get("ws");
    if (!wsValido(ws)) return NextResponse.json({ ok: true, applied: false, motivo: "sin organización" });
    const pago = await leerPago(ws, providerPaymentId);
    if (!pago) return NextResponse.json({ ok: true, applied: false, motivo: "el pago no es de esa organización" });
    if (!pedidoDeReferencia(pago.externalReference)) return NextResponse.json({ ok: true, applied: false, motivo: "no es de un pedido de impresión" });
    const r = await acreditarPagoImpresion(ws, pago);
    return NextResponse.json({ ok: true, applied: r.ok && !r.yaEstaba, resultado: r.ok ? (r.yaEstaba ? "ya_acreditado" : "acreditado") : r.error });
  } catch (error) {
    console.error("[impresiones] falló el aviso de Mercado Pago", { providerPaymentId, detalle: sanitizeError(error) });
    return NextResponse.json({ ok: false, error: "no se pudo aplicar" }, { status: 200 });
  }
}

/** Mercado Pago también avisa por GET en algunas configuraciones. Mismo camino. */
export async function GET(request: Request) {
  return POST(request);
}
