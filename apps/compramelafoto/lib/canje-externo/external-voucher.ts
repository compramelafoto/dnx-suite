/**
 * Combo cobrado por fuera: cómo se guarda y cómo se lee desde el link de la familia.
 *
 * Sin columnas nuevas. Cada combo es un `Order` de origen PREVENTA_PACK, PAID y con
 * `totalCents = 0` (la plata no pasó por la plataforma, así no infla ventas ni informes),
 * y la configuración vive en `redemptionPaymentRefsJson` con `kind = EXTERNAL_PREPAID_PRINT_CREDIT`.
 * No lleva `preventaPackSnapshotJson`, así que el canje viejo de preventa lo rechaza solo.
 *
 * El link es `PackAccessToken` (sólo se guarda el hash). Cuando la familia arma su pedido,
 * el pedido nuevo apunta al combo (`redeemsOrderId`) y el combo al pedido
 * (`redemptionOrderId`); ambos son únicos, así un combo no se canjea dos veces.
 */

import { prisma } from "@/lib/prisma";
import { getOrderIdForPackAccessToken } from "@/lib/preventa-canjeable/pack-access-tokens";
import type { PrepaidPrintCredit } from "./prepaid-print-credit";

export const EXTERNAL_VOUCHER_KIND = "EXTERNAL_PREPAID_PRINT_CREDIT";

export type ExternalVoucherRefs = PrepaidPrintCredit & {
  kind: typeof EXTERNAL_VOUCHER_KIND;
  /** Para el cartel de bienvenida: "el combo de Josefina". */
  studentName?: string | null;
  parentName?: string | null;
  /** Texto corto del combo, p. ej. "3 fotos impresas 15x21 con su digital". */
  label?: string | null;
};

export function parseExternalVoucherRefs(raw: unknown): ExternalVoucherRefs | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r.kind !== EXTERNAL_VOUCHER_KIND) return null;
  const printUnits = Number(r.printUnits);
  if (!Number.isInteger(printUnits) || printUnits <= 0) return null;
  if (typeof r.size !== "string" || !r.size.trim()) return null;
  return {
    kind: EXTERNAL_VOUCHER_KIND,
    printUnits,
    size: r.size,
    includesDigital: r.includesDigital === true,
    studentName: typeof r.studentName === "string" ? r.studentName : null,
    parentName: typeof r.parentName === "string" ? r.parentName : null,
    label: typeof r.label === "string" ? r.label : null,
  };
}

export type ExternalVoucher = {
  orderId: number;
  albumId: number;
  refs: ExternalVoucherRefs;
  /** Pedido que hoy tiene reservado el combo (pagado o esperando el pago de los extras). */
  linkedOrderId: number | null;
  /** El combo ya se usó en un pedido confirmado: no se puede volver a canjear. */
  redeemed: boolean;
};

export type ExternalVoucherLookup =
  | { ok: true; voucher: ExternalVoucher }
  | { ok: false; error: "invalid" | "expired" | "revoked" | "other_album" };

/**
 * `albumId` se exige cuando el pedido llega desde una galería concreta (cotizar, comprar):
 * un link de otro álbum no tiene que aplicar crédito ahí. La página de canje lo omite,
 * porque es el link el que dice de qué álbum es.
 */
export async function loadExternalVoucherByToken(
  token: string,
  albumId?: number
): Promise<ExternalVoucherLookup> {
  const lookup = await getOrderIdForPackAccessToken(token);
  if (!lookup.ok) {
    return { ok: false, error: lookup.error === "invalid" ? "invalid" : lookup.error };
  }
  const order = await prisma.order.findUnique({
    where: { id: lookup.orderId },
    select: {
      id: true,
      albumId: true,
      origin: true,
      status: true,
      redemptionPaymentRefsJson: true,
      redemptionOrderId: true,
    },
  });
  const refs = parseExternalVoucherRefs(order?.redemptionPaymentRefsJson);
  if (!order || !refs || order.origin !== "PREVENTA_PACK" || order.status !== "PAID") {
    return { ok: false, error: "invalid" };
  }
  if (albumId != null && order.albumId !== albumId) return { ok: false, error: "other_album" };

  let redeemed = false;
  if (order.redemptionOrderId != null) {
    const linked = await prisma.order.findUnique({
      where: { id: order.redemptionOrderId },
      select: { status: true },
    });
    redeemed = linked?.status === "PAID";
  }
  return {
    ok: true,
    voucher: {
      orderId: order.id,
      albumId: order.albumId,
      refs,
      linkedOrderId: order.redemptionOrderId,
      redeemed,
    },
  };
}

export const EXTERNAL_VOUCHER_ERROR_MESSAGES: Record<string, string> = {
  invalid: "Este link de canje no es válido. Pedile uno nuevo al fotógrafo.",
  expired: "Este link de canje venció. Pedile uno nuevo al fotógrafo.",
  revoked: "Este link de canje fue reemplazado por uno nuevo. Pedile el último al fotógrafo.",
  other_album: "Este link de canje es de otro álbum.",
  redeemed: "Este combo ya fue canjeado.",
};

/**
 * Reserva el combo para un pedido nuevo. Si lo tenía otro pedido que nunca se pagó (la
 * familia volvió atrás desde Mercado Pago), se lo saca primero: lo que vale es el último
 * intento. Un pedido pagado no se pisa nunca.
 */
export async function attachVoucherToOrder(voucher: ExternalVoucher, orderId: number): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const current = await tx.order.findUnique({
      where: { id: voucher.orderId },
      select: { redemptionOrderId: true },
    });
    const previous = current?.redemptionOrderId ?? null;
    if (previous != null && previous !== orderId) {
      const prev = await tx.order.findUnique({ where: { id: previous }, select: { status: true } });
      if (prev?.status === "PAID") throw new Error("VOUCHER_ALREADY_REDEEMED");
      await tx.order.update({ where: { id: voucher.orderId }, data: { redemptionOrderId: null } });
      await tx.order.update({ where: { id: previous }, data: { redeemsOrderId: null } });
    }
    await tx.order.update({ where: { id: orderId }, data: { redeemsOrderId: voucher.orderId } });
    await tx.order.update({ where: { id: voucher.orderId }, data: { redemptionOrderId: orderId } });
  });
}
