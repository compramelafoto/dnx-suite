import "server-only";
import { prisma } from "@repo/db";
import { createMercadoPagoCheckoutProLiveAdapter } from "@repo/payments/mercado-pago";
import { resolveWorkspaceCollector } from "@/lib/payments/connect/collector";
import { sanitizeError } from "@/lib/payments/connect/log";
import { creditMembershipPayment } from "./credit-payment";
import { decimalArsToMinor } from "./money";
import {
  findAbandoned,
  selectPaymentsToReconcile,
  type PendingPayment,
} from "./reconcile-policy";

export type ReconcileReport = {
  revisados: number;
  acreditados: number;
  rechazados: number;
  sinNovedad: number;
  conError: number;
  abandonados: number;
};

/**
 * Vuelve a preguntarle a MercadoPago por los pagos que quedaron pendientes.
 *
 * Los webhooks se pierden: es un hecho, no una hipótesis. Sin esto un socio paga y sigue
 * debiendo, y nadie se entera hasta que reclama.
 *
 * Se busca **por la referencia externa**, que es el identificador de nuestra intención de
 * pago, y no por el del proveedor: el del proveedor es justamente el dato que no llegó.
 */
export async function reconcilePendingDues(
  opciones: { now?: Date; maxPerRun?: number } = {},
): Promise<ReconcileReport> {
  const ahora = opciones.now ?? new Date();

  const pendientes: PendingPayment[] = await prisma.membershipPayment.findMany({
    where: { status: "PENDIENTE" },
    select: { id: true, workspaceId: true, createdAt: true },
    orderBy: { createdAt: "asc" },
    take: 500,
  });

  const abandonados = findAbandoned(pendientes, { now: ahora });
  if (abandonados.length > 0) {
    // No se consultan más, pero que existan es algo que alguien tiene que mirar a mano.
    console.warn("[fotoffice][conciliacion] pagos pendientes fuera de la ventana", {
      cantidad: abandonados.length,
      ids: abandonados.slice(0, 20).map((p) => p.id),
    });
  }

  const aRevisar = selectPaymentsToReconcile(pendientes, {
    now: ahora,
    ...(opciones.maxPerRun !== undefined ? { maxPerRun: opciones.maxPerRun } : {}),
  });

  const reporte: ReconcileReport = {
    revisados: aRevisar.length,
    acreditados: 0,
    rechazados: 0,
    sinNovedad: 0,
    conError: 0,
    abandonados: abandonados.length,
  };

  // El token es por institución: se resuelve una vez y se reutiliza para todos sus pagos.
  const tokens = new Map<string, string | null>();

  for (const pendiente of aRevisar) {
    try {
      if (!tokens.has(pendiente.workspaceId)) {
        const collector = await resolveWorkspaceCollector(pendiente.workspaceId);
        tokens.set(pendiente.workspaceId, collector.ok ? collector.collector.accessToken : null);
      }
      const token = tokens.get(pendiente.workspaceId);
      if (!token) {
        reporte.conError += 1;
        continue;
      }

      const adapter = createMercadoPagoCheckoutProLiveAdapter({ accessToken: token });
      const pago = await adapter.searchPaymentsByExternalReference(pendiente.id);
      if (!pago) {
        // MercadoPago no conoce ningún pago con esa referencia: el socio abrió el checkout y
        // no lo completó. Se deja pendiente hasta que salga de la ventana.
        reporte.sinNovedad += 1;
        continue;
      }

      const intento = await prisma.membershipPayment.findUnique({
        where: { id: pendiente.id },
        select: { amountArs: true },
      });

      const resultado = await creditMembershipPayment({
        paymentId: pendiente.id,
        providerPaymentRef: pago.providerPaymentId,
        providerStatus: String(
          (pago.rawSanitized as Record<string, unknown>).status ?? pago.status,
        ),
        paidAmountMinor:
          pago.amountMinor || (intento ? decimalArsToMinor(intento.amountArs) : 0),
        paidAt: ahora,
      });

      if (!resultado.ok || !resultado.applied) {
        reporte.sinNovedad += 1;
      } else if (resultado.motivo.includes("acreditado")) {
        reporte.acreditados += 1;
      } else {
        reporte.rechazados += 1;
      }
    } catch (error) {
      // Un pago que falla no puede frenar a los demás.
      reporte.conError += 1;
      console.error("[fotoffice][conciliacion] fallo revisando un pago", {
        paymentId: pendiente.id,
        detalle: sanitizeError(error),
      });
    }
  }

  return reporte;
}
