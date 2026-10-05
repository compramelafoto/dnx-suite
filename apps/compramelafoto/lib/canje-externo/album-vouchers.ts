/**
 * Combos cobrados por fuera de un álbum, para el panel "Canjes" de la fotógrafa.
 *
 * El link de cada familia no se puede volver a leer (en la base sólo queda su hash), así
 * que el panel genera uno nuevo cada vez que se envía. Los links anteriores siguen
 * sirviendo: el combo igual se canjea una sola vez.
 */

import { prisma } from "@/lib/prisma";
import { createPackAccessTokenForOrder } from "@/lib/preventa-canjeable/pack-access-tokens";
import { EXTERNAL_VOUCHER_KIND, parseExternalVoucherRefs } from "./external-voucher";
import { buildCanjeWhatsAppMessage, buildWhatsAppUrl } from "./canje-whatsapp";

export type AlbumVoucherRow = {
  comboId: number;
  studentName: string | null;
  parentName: string | null;
  phone: string | null;
  comboLabel: string;
  createdAt: string;
  estado: "sin_canjear" | "esperando_pago" | "canjeado";
  pedido: { id: number; createdAt: string; buyerName: string | null; buyerEmail: string } | null;
};

export async function listAlbumVouchers(albumId: number): Promise<AlbumVoucherRow[]> {
  const combos = await prisma.order.findMany({
    where: {
      albumId,
      origin: "PREVENTA_PACK",
      status: "PAID",
      redemptionPaymentRefsJson: { path: ["kind"], equals: EXTERNAL_VOUCHER_KIND },
    },
    select: {
      id: true,
      buyerPhone: true,
      createdAt: true,
      redemptionPaymentRefsJson: true,
      redemptionOrderId: true,
    },
    orderBy: { id: "asc" },
  });

  const pedidoIds = combos.map((c) => c.redemptionOrderId).filter((id): id is number => id != null);
  const pedidos = pedidoIds.length
    ? await prisma.order.findMany({
        where: { id: { in: pedidoIds } },
        select: { id: true, status: true, createdAt: true, buyerName: true, buyerEmail: true },
      })
    : [];
  const pedidoPorId = new Map(pedidos.map((p) => [p.id, p]));

  const rows: AlbumVoucherRow[] = [];
  for (const c of combos) {
    const refs = parseExternalVoucherRefs(c.redemptionPaymentRefsJson);
    if (!refs) continue;
    const pedido = c.redemptionOrderId != null ? pedidoPorId.get(c.redemptionOrderId) ?? null : null;
    rows.push({
      comboId: c.id,
      studentName: refs.studentName ?? null,
      parentName: refs.parentName ?? null,
      phone: c.buyerPhone,
      comboLabel: refs.label ?? `${refs.printUnits} fotos impresas ${refs.size}`,
      createdAt: c.createdAt.toISOString(),
      estado: !pedido ? "sin_canjear" : pedido.status === "PAID" ? "canjeado" : "esperando_pago",
      pedido: pedido
        ? {
            id: pedido.id,
            createdAt: pedido.createdAt.toISOString(),
            buyerName: pedido.buyerName,
            buyerEmail: pedido.buyerEmail,
          }
        : null,
    });
  }
  return rows.sort((a, b) => (a.studentName ?? "").localeCompare(b.studentName ?? "", "es"));
}

export type VoucherShareLink = { link: string; message: string; whatsappUrl: string | null };

/** Link nuevo para una familia, con su mensaje de WhatsApp. */
export async function createVoucherShareLink(params: {
  albumId: number;
  comboId: number;
  baseUrl: string;
}): Promise<VoucherShareLink | null> {
  const combo = await prisma.order.findFirst({
    where: { id: params.comboId, albumId: params.albumId, origin: "PREVENTA_PACK", status: "PAID" },
    select: {
      id: true,
      buyerPhone: true,
      redemptionPaymentRefsJson: true,
      album: { select: { title: true } },
    },
  });
  const refs = parseExternalVoucherRefs(combo?.redemptionPaymentRefsJson);
  if (!combo || !refs) return null;

  const token = await createPackAccessTokenForOrder(combo.id, { ttlDays: 60, revokeExisting: false });
  if (!token) return null;
  const link = `${params.baseUrl.replace(/\/+$/, "")}/canje/${token.token}`;
  const message = buildCanjeWhatsAppMessage({
    parentName: refs.parentName ?? null,
    studentName: refs.studentName ?? null,
    albumTitle: combo.album.title,
    comboLabel: refs.label ?? `${refs.printUnits} fotos impresas ${refs.size}`,
    printUnits: refs.printUnits,
    link,
  });
  return {
    link,
    message,
    whatsappUrl: combo.buyerPhone ? buildWhatsAppUrl(combo.buyerPhone, message) : null,
  };
}
