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
import { EXTERNAL_PREVENTA_KIND, parseExternalPreventaRefs } from "./external-preventa";
import {
  buildCanjeWhatsAppMessage,
  buildPreventaCanjeWhatsAppMessage,
  buildWhatsAppUrl,
} from "./canje-whatsapp";

export type AlbumVoucherRow = {
  comboId: number;
  studentName: string | null;
  parentName: string | null;
  phone: string | null;
  /** Curso del alumno (packs de colegio cargados por fuera). */
  courseName: string | null;
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
      OR: [
        { redemptionPaymentRefsJson: { path: ["kind"], equals: EXTERNAL_VOUCHER_KIND } },
        { redemptionPaymentRefsJson: { path: ["kind"], equals: EXTERNAL_PREVENTA_KIND } },
      ],
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
    const combo = parseExternalVoucherRefs(c.redemptionPaymentRefsJson);
    const pack = combo ? null : parseExternalPreventaRefs(c.redemptionPaymentRefsJson);
    if (!combo && !pack) continue;
    const pedido = c.redemptionOrderId != null ? pedidoPorId.get(c.redemptionOrderId) ?? null : null;
    rows.push({
      comboId: c.id,
      studentName: combo?.studentName ?? pack?.studentName ?? null,
      parentName: combo?.parentName ?? pack?.parentName ?? null,
      phone: c.buyerPhone,
      courseName: pack?.courseName ?? null,
      comboLabel: combo
        ? combo.label ?? `${combo.printUnits} fotos impresas ${combo.size}`
        : pack?.label ?? "Pack de preventa",
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
  // Los packs de colegio se cargan en el orden de la lista (nivel, curso, alumno): ese orden
  // es el que sirve para recorrerlos curso por curso. Los combos sueltos, por nombre.
  return rows.sort((a, b) => {
    if (a.courseName || b.courseName) return a.comboId - b.comboId;
    return (a.studentName ?? "").localeCompare(b.studentName ?? "", "es");
  });
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
  const pack = refs ? null : parseExternalPreventaRefs(combo?.redemptionPaymentRefsJson);
  if (!combo || (!refs && !pack)) return null;

  const token = await createPackAccessTokenForOrder(combo.id, { ttlDays: 90, revokeExisting: false });
  if (!token) return null;
  const base = params.baseUrl.replace(/\/+$/, "");
  if (pack) {
    const link = `${base}/canje/preventa/${token.token}`;
    const message = buildPreventaCanjeWhatsAppMessage({
      parentName: pack.parentName,
      studentName: pack.studentName,
      albumTitle: combo.album.title,
      packLabel: pack.label ?? "tu pack",
      link,
    });
    return {
      link,
      message,
      whatsappUrl: combo.buyerPhone ? buildWhatsAppUrl(combo.buyerPhone, message) : null,
    };
  }
  if (!refs) return null;
  const link = `${base}/canje/${token.token}`;
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
