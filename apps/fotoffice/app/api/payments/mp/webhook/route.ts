import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { createMercadoPagoCheckoutProLiveAdapter } from "@repo/payments/mercado-pago";
import { creditMembershipPayment } from "@/lib/membership/credit-payment";
import { decimalArsToMinor } from "@/lib/membership/money";
import { resolveWorkspaceCollector } from "@/lib/payments/connect/collector";
import { sanitizeError } from "@/lib/payments/connect/log";

export const dynamic = "force-dynamic";

/**
 * Aviso de MercadoPago sobre un pago de cuotas.
 *
 * **Siempre responde 200**, incluso cuando no puede aplicar el aviso. Devolver un error hace
 * que MercadoPago reintente durante días, y el problema casi nunca se arregla reintentando:
 * lo que hay es un registro con el motivo, y una conciliación que vuelve a preguntar.
 *
 * No se confía en el cuerpo del aviso: trae un identificador y nada más. El importe y el
 * estado se le preguntan a MercadoPago con el token de la institución. Un cuerpo falsificado
 * no puede acreditar un pago que no existe.
 */
export async function POST(request: Request) {
  let providerPaymentId: string | null = null;
  try {
    const url = new URL(request.url);
    const cuerpo = (await request.json().catch(() => ({}))) as {
      type?: string;
      action?: string;
      data?: { id?: string | number };
    };
    const tipo = cuerpo.type ?? url.searchParams.get("type") ?? "";
    if (tipo && tipo !== "payment") {
      return NextResponse.json({ ignored: `tipo ${tipo}` }, { status: 200 });
    }
    const crudo = cuerpo.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id");
    providerPaymentId = crudo != null ? String(crudo) : null;
  } catch {
    return NextResponse.json({ ignored: "cuerpo ilegible" }, { status: 200 });
  }

  if (!providerPaymentId) {
    return NextResponse.json({ ignored: "sin identificador de pago" }, { status: 200 });
  }

  try {
    // Ya visto y acreditado: no hace falta volver a preguntarle a MercadoPago.
    const yaAcreditado = await prisma.membershipPayment.findUnique({
      where: { providerPaymentRef: providerPaymentId },
      select: { status: true },
    });
    if (yaAcreditado?.status === "ACREDITADO") {
      return NextResponse.json({ ok: true, applied: false, motivo: "aviso repetido" });
    }

    // Se necesita el token de alguna institución para consultar el pago. Se resuelve por la
    // intención, que es la que sabe de qué workspace es.
    const pendientes = await prisma.membershipPayment.findMany({
      where: { status: "PENDIENTE" },
      select: { id: true, workspaceId: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    if (pendientes.length === 0) {
      return NextResponse.json({ ok: true, applied: false, motivo: "sin pagos pendientes" });
    }

    // Todas las intenciones pendientes de un mismo workspace comparten cobrador; se agrupa
    // para no pedir el token una vez por intención.
    const porWorkspace = new Set(pendientes.map((p) => p.workspaceId));

    for (const workspaceId of porWorkspace) {
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

      const referencia = pago.externalReference;
      if (!referencia) {
        return NextResponse.json({ ok: true, applied: false, motivo: "pago sin referencia" });
      }

      const intento = await prisma.membershipPayment.findUnique({
        where: { id: referencia },
        select: { id: true, workspaceId: true, amountArs: true },
      });
      if (!intento || intento.workspaceId !== workspaceId) continue;

      const resultado = await creditMembershipPayment({
        paymentId: referencia,
        providerPaymentRef: providerPaymentId,
        providerStatus: String(
          (pago.rawSanitized as Record<string, unknown>).status ?? pago.status,
        ),
        // Se imputa lo que MercadoPago dice haber cobrado, no lo que la intención esperaba:
        // si el socio pagó de menos, se imputa de menos.
        paidAmountMinor: pago.amountMinor || decimalArsToMinor(intento.amountArs),
        paidAt: new Date(),
      });

      return NextResponse.json({ ...resultado });
    }

    return NextResponse.json({ ok: true, applied: false, motivo: "no se pudo resolver el pago" });
  } catch (error) {
    console.error("[fotoffice][webhook] fallo procesando el aviso", {
      providerPaymentId,
      detalle: sanitizeError(error),
    });
    // 200 igual: reintentar no arregla un error propio, y el detalle ya quedó registrado.
    return NextResponse.json({ ok: false, motivo: "error interno" }, { status: 200 });
  }
}
