/**
 * Registro de eventos de auditoría para pedidos y antifraude.
 */

import { prisma } from "@/lib/prisma";

export type OrderAuditEventType =
  | "ORDER_CREATED"
  | "ORDER_UPDATED"
  | "PAYMENT_INITIATED"
  | "PAYMENT_PENDING"
  | "PAYMENT_APPROVED"
  | "PAYMENT_REJECTED"
  | "PAYMENT_REFUNDED"
  | "PAYMENT_CHARGED_BACK"
  | "PAYMENT_EXPIRED"
  | "CUSTOMER_DATA_RELEASED"
  | "ORDER_ITEMS_RELEASED"
  | "ORDER_SENT_TO_LAB"
  | "ORDER_VIEWED_PHOTOGRAPHER"
  | "ORDER_VIEWED_LAB"
  | "ADMIN_OVERRIDE"
  | "ACCOUNT_RESTRICTED"
  | "FRAUD_ALERT_CREATED"
  /** Canje preventa bloqueado: local PAID pero MP ya no approved (gate previo al canje) */
  | "REDEEM_BLOCKED_STALE_PAYMENT"
  /** Reembolso/contracargo después de canjear: se conserva el canje y se registra el riesgo */
  | "PAYMENT_REVERSED_AFTER_REDEEM"
  /** Job de reconciliación alineó un Order PAID que en MP ya no estaba aprobado */
  | "MP_RECONCILIATION_ALBUM_PAID_CORRECTED"
  /** Reconciliación ejecutó sync de PreCompraOrder contra MP (metadata.source) */
  | "MP_RECONCILIATION_PRECOMPRA_INSPECTED"
  /** Entitlement activo alineado con PreCompraOrder cancelada (void) */
  | "MP_RECONCILIATION_ENTITLEMENT_VOIDED"
  /** PAID_HELD en DB pero sin pagos encontrados en MP en la ventana buscada */
  | "MP_RECONCILIATION_PRECOMPRA_NO_MP_PAYMENT"
  /** Reconciliación/webhook: pedido FAILED local con pago approved en MP → PAID */
  | "MP_RECONCILIATION_ALBUM_FAILED_RECOVERED"
  /** Checkout cliente: aceptación de Términos + Política de Privacidad */
  | "TERMS_ACCEPTED";

export interface RegisterAuditEventParams {
  actorUserId?: number | null;
  actorRole?: string | null;
  targetOrderType: "PRINT_ORDER" | "ALBUM_ORDER" | "PRECOMPRA_ORDER";
  targetOrderId: number;
  targetAlbumId?: number | null;
  eventType: OrderAuditEventType;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
  riskScoreSnapshot?: number | null;
}

export async function registerAuditEvent(
  params: RegisterAuditEventParams
): Promise<void> {
  try {
    await prisma.orderAuditLog.create({
      data: {
        actorUserId: params.actorUserId ?? undefined,
        actorRole: params.actorRole ?? undefined,
        targetOrderType: params.targetOrderType,
        targetOrderId: params.targetOrderId,
        targetAlbumId: params.targetAlbumId ?? undefined,
        eventType: params.eventType,
        ipAddress: params.ipAddress ?? undefined,
        userAgent: params.userAgent ?? undefined,
        metadata: (params.metadata ?? undefined) as object | undefined,
        riskScoreSnapshot: params.riskScoreSnapshot ?? undefined,
      },
    });
  } catch (err) {
    console.error("Error registrando evento de auditoría:", err);
  }
}

export function getRequestMetadata(req: Request): {
  ipAddress: string | null;
  userAgent: string | null;
} {
  const headers = req.headers;
  const ipAddress =
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    null;
  const userAgent = headers.get("user-agent") || null;
  return { ipAddress, userAgent };
}
