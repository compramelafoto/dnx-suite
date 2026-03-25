/**
 * Helpers para determinar si un pedido pendiente fue reemplazado por otro posterior.
 * Usado en recuperación de pedidos abandonados para evitar recordatorios obsoletos.
 */

import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/order-claims";

export type OrderForSupersededCheck = {
  id: number;
  albumId: number;
  buyerEmail: string;
  buyerUserId: number | null;
  buyerPhone: string | null;
  createdAt: Date;
};

/**
 * Normaliza teléfono para comparación: solo dígitos.
 */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone || typeof phone !== "string") return null;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 8 ? digits : null;
}

/**
 * Estados que se consideran "supersedores": un pedido posterior con estos estados
 * indica que el cliente siguió activo y el pedido viejo quedó obsoleto.
 */
const SUPERSEDING_STATUSES = ["PAID", "PENDING"] as const;

export type IsOrderSupersededOptions = {
  /** Si true (default), también considera PENDING como supersedente. Útil cuando el cliente rehizo checkout. */
  includePending?: boolean;
};

/**
 * Determina si un pedido pendiente fue reemplazado por otro posterior del mismo cliente para el mismo álbum.
 *
 * Reglas:
 * - Mismo cliente: buyerUserId > buyerEmail normalizado > buyerPhone normalizado
 * - Pedido posterior: createdAt > order.createdAt
 * - Estados supersedentes: PAID siempre; PENDING si includePending=true
 *
 * @returns { superseded, reason, newerOrderId } para logging
 * - reason: superseded_by_paid_order si el pedido posterior está PAID; superseded_by_newer_order si está PENDING
 */
export type SupersededReason = "superseded_by_paid_order" | "superseded_by_newer_order";

export async function isOrderSuperseded(
  order: OrderForSupersededCheck,
  options: IsOrderSupersededOptions = {}
): Promise<{ superseded: boolean; reason?: SupersededReason; newerOrderId?: number }> {
  const { includePending = true } = options;
  const statuses = includePending ? SUPERSEDING_STATUSES : (["PAID"] as const);

  const hasUserId = order.buyerUserId != null;
  const emailNorm = normalizeEmail(order.buyerEmail);
  const hasEmail = !!emailNorm;
  const phoneNorm = normalizePhone(order.buyerPhone);
  const hasPhone = !!phoneNorm;

  if (!hasUserId && !hasEmail && !hasPhone) {
    return { superseded: false };
  }

  const createdAt = order.createdAt;

  const toResult = (newer: { id: number; status: string } | null) => {
    if (!newer) return { superseded: false };
    const reason: SupersededReason =
      newer.status === "PAID" ? "superseded_by_paid_order" : "superseded_by_newer_order";
    return { superseded: true, reason, newerOrderId: newer.id };
  };

  if (hasUserId) {
    const newer = await prisma.order.findFirst({
      where: {
        albumId: order.albumId,
        buyerUserId: order.buyerUserId,
        createdAt: { gt: createdAt },
        status: { in: [...statuses] },
      },
      select: { id: true, status: true },
      orderBy: { createdAt: "desc" },
    });
    return toResult(newer);
  }

  if (hasEmail) {
    const candidates = await prisma.order.findMany({
      where: {
        albumId: order.albumId,
        createdAt: { gt: createdAt },
        status: { in: [...statuses] },
      },
      select: { id: true, status: true, buyerEmail: true },
      orderBy: { createdAt: "desc" },
    });
    const newer = candidates.find((o) => normalizeEmail(o.buyerEmail) === emailNorm);
    return toResult(newer ?? null);
  }

  if (hasPhone) {
    const candidates = await prisma.order.findMany({
      where: {
        albumId: order.albumId,
        createdAt: { gt: createdAt },
        status: { in: [...statuses] },
      },
      select: { id: true, status: true, buyerPhone: true },
      orderBy: { createdAt: "desc" },
    });
    const newer = candidates.find((o) => normalizePhone(o.buyerPhone) === phoneNorm);
    return toResult(newer ?? null);
  }

  return { superseded: false };
}
