/**
 * Link compartido de regalo: UN link para todas las familias de un álbum.
 *
 * Caso de uso: el fotógrafo no tiene la lista de familias, pero quiere que cada una que
 * entre tenga N fotos impresas de regalo y pueda sumar extras pagas. El fotógrafo revisa
 * después, nombre por nombre, quién lo usó (panel Publicación → Canjes).
 *
 * Sin columnas nuevas, con la misma pieza que el canje por familia:
 * - El link compartido es un `Order` PREVENTA_PACK, PAID, $0, con
 *   `redemptionPaymentRefsJson.kind = EXTERNAL_SHARED_GIFT_LINK`. Es una plantilla: no se
 *   canjea nunca. Su `PackAccessToken` es el link que se reparte.
 * - Cuando una familia deja sus datos, se crea para ella un combo común
 *   (`EXTERNAL_PREPAID_PRINT_CREDIT`, ver `external-voucher.ts`) con su propio token, y
 *   sigue el canje por pasos de siempre (`/canje/<token de la familia>`).
 * - Un mismo email o WhatsApp no recibe dos regalos del mismo link: si vuelve, se le da
 *   un link nuevo de SU combo (o se le avisa que ya lo usó).
 */

import { CheckoutPaymentSource, OrderOrigin, OrderStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  createPackAccessTokenForOrder,
  getOrderIdForPackAccessToken,
} from "@/lib/preventa-canjeable/pack-access-tokens";
import { EXTERNAL_VOUCHER_KIND, type ExternalVoucherRefs } from "./external-voucher";
import { telefonoWhatsAppArgentina } from "./canje-whatsapp";

export const EXTERNAL_SHARED_GIFT_LINK_KIND = "EXTERNAL_SHARED_GIFT_LINK";

/** Email de relleno del pedido plantilla (el campo es obligatorio en el esquema). */
const PLANTILLA_EMAIL = "link-compartido@canje-externo.invalid";

export type SharedGiftLinkRefs = {
  kind: typeof EXTERNAL_SHARED_GIFT_LINK_KIND;
  printUnits: number;
  size: string;
  includesDigital: boolean;
  /** Texto corto del regalo, p. ej. "3 fotos impresas 15x20 de regalo". */
  label: string;
};

export function parseSharedGiftLinkRefs(raw: unknown): SharedGiftLinkRefs | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r.kind !== EXTERNAL_SHARED_GIFT_LINK_KIND) return null;
  const printUnits = Number(r.printUnits);
  if (!Number.isInteger(printUnits) || printUnits <= 0) return null;
  if (typeof r.size !== "string" || !r.size.trim()) return null;
  return {
    kind: EXTERNAL_SHARED_GIFT_LINK_KIND,
    printUnits,
    size: r.size,
    includesDigital: r.includesDigital === true,
    label: typeof r.label === "string" && r.label.trim() ? r.label : `${printUnits} fotos impresas de regalo`,
  };
}

export function describeSharedGift(printUnits: number, size: string, includesDigital: boolean): string {
  const tamano = size.replace(/\s*cm$/i, "").trim();
  return `${printUnits} ${printUnits === 1 ? "foto impresa" : "fotos impresas"} ${tamano}${
    includesDigital ? " con su digital" : ""
  } de regalo`;
}

export type SharedGiftLink = { orderId: number; albumId: number; refs: SharedGiftLinkRefs };

/** Devuelve el link compartido si el token es de uno vigente; null si es de otra cosa. */
export async function loadSharedGiftLinkByToken(
  token: string
): Promise<{ ok: true; link: SharedGiftLink } | { ok: false; error: "invalid" | "expired" | "revoked" } | null> {
  const lookup = await getOrderIdForPackAccessToken(token);
  if (!lookup.ok) return lookup.error === "invalid" ? null : { ok: false, error: lookup.error };
  const order = await prisma.order.findUnique({
    where: { id: lookup.orderId },
    select: { id: true, albumId: true, origin: true, status: true, redemptionPaymentRefsJson: true },
  });
  const refs = parseSharedGiftLinkRefs(order?.redemptionPaymentRefsJson);
  if (!order || !refs) return null;
  if (order.origin !== OrderOrigin.PREVENTA_PACK || order.status !== OrderStatus.PAID) {
    return { ok: false, error: "revoked" };
  }
  return { ok: true, link: { orderId: order.id, albumId: order.albumId, refs } };
}

export type FamilyData = {
  parentName: string;
  studentName: string;
  email: string;
  phone: string;
};

export type FamilyDataValidation =
  | { ok: true; data: FamilyData & { phoneWhatsApp: string } }
  | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function limpiar(v: unknown, max = 120): string {
  return String(v ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/** Valida lo que carga la familia. Todos los datos son obligatorios. */
export function validateFamilyData(input: Partial<Record<keyof FamilyData, unknown>>): FamilyDataValidation {
  const parentName = limpiar(input.parentName);
  const studentName = limpiar(input.studentName);
  const email = limpiar(input.email, 200).toLowerCase();
  const phone = limpiar(input.phone, 40);
  if (parentName.split(" ").filter(Boolean).length < 2) {
    return { ok: false, error: "Escribí tu nombre y apellido." };
  }
  if (studentName.split(" ").filter(Boolean).length < 2) {
    return { ok: false, error: "Escribí el nombre y apellido de quien aparece en las fotos." };
  }
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Revisá el email: parece que tiene un error." };
  const phoneWhatsApp = telefonoWhatsAppArgentina(phone);
  if (!phoneWhatsApp) {
    return { ok: false, error: "Revisá el WhatsApp: tiene que tener 10 números con el código de área (ej. 341 555 1234)." };
  }
  return { ok: true, data: { parentName, studentName, email, phone, phoneWhatsApp } };
}

export type ClaimResult =
  | { ok: true; familyToken: string; reused: boolean }
  | { ok: false; error: "already_redeemed"; albumSlug: string | null };

/**
 * Crea (o recupera) el combo de regalo de una familia a partir del link compartido.
 * El duplicado se busca por email o por WhatsApp entre los combos de ESTE link.
 */
export async function claimSharedGift(link: SharedGiftLink, data: FamilyData & { phoneWhatsApp: string }): Promise<ClaimResult> {
  const phoneDigits = data.phoneWhatsApp.replace(/^549/, "");
  const previos = await prisma.order.findMany({
    where: {
      albumId: link.albumId,
      origin: OrderOrigin.PREVENTA_PACK,
      status: OrderStatus.PAID,
      redemptionPaymentRefsJson: { path: ["sharedLinkOrderId"], equals: link.orderId },
      OR: [{ buyerEmail: data.email }, { buyerPhone: phoneDigits }],
    },
    select: { id: true, redemptionOrderId: true },
    orderBy: { id: "asc" },
    take: 1,
  });
  const previo = previos[0];
  if (previo) {
    if (previo.redemptionOrderId != null) {
      const pedido = await prisma.order.findUnique({
        where: { id: previo.redemptionOrderId },
        select: { status: true },
      });
      if (pedido?.status === OrderStatus.PAID) {
        const album = await prisma.album.findUnique({ where: { id: link.albumId }, select: { publicSlug: true } });
        return { ok: false, error: "already_redeemed", albumSlug: album?.publicSlug ?? null };
      }
    }
    const token = await createPackAccessTokenForOrder(previo.id, { ttlDays: 60 });
    if (!token) throw new Error(`No se pudo renovar el link del combo ${previo.id}`);
    return { ok: true, familyToken: token.token, reused: true };
  }

  const refs: ExternalVoucherRefs & { sharedLinkOrderId: number; isGift: true } = {
    kind: EXTERNAL_VOUCHER_KIND,
    printUnits: link.refs.printUnits,
    size: link.refs.size,
    includesDigital: link.refs.includesDigital,
    studentName: data.studentName,
    parentName: data.parentName,
    label: link.refs.label,
    sharedLinkOrderId: link.orderId,
    isGift: true,
  };
  const combo = await prisma.order.create({
    data: {
      albumId: link.albumId,
      buyerEmail: data.email,
      buyerName: `${data.parentName} (familia de ${data.studentName})`,
      buyerPhone: phoneDigits,
      status: OrderStatus.PAID,
      totalCents: 0,
      platformCommissionCents: 0,
      origin: OrderOrigin.PREVENTA_PACK,
      checkoutPaymentSource: CheckoutPaymentSource.PREPAID_PACK,
      redemptionPaymentRefsJson: refs as unknown as Prisma.InputJsonValue,
    },
    select: { id: true },
  });
  const token = await createPackAccessTokenForOrder(combo.id, { ttlDays: 60 });
  if (!token) throw new Error(`No se pudo crear el link del combo ${combo.id}`);
  return { ok: true, familyToken: token.token, reused: false };
}

/** Crea el pedido plantilla y su link compartido. Lo usa el script de alta. */
export async function createSharedGiftLink(params: {
  albumId: number;
  printUnits: number;
  size: string;
  includesDigital: boolean;
  ttlDays: number;
}): Promise<{ orderId: number; token: string; expiresAt: Date }> {
  const refs: SharedGiftLinkRefs = {
    kind: EXTERNAL_SHARED_GIFT_LINK_KIND,
    printUnits: params.printUnits,
    size: params.size,
    includesDigital: params.includesDigital,
    label: describeSharedGift(params.printUnits, params.size, params.includesDigital),
  };
  const order = await prisma.order.create({
    data: {
      albumId: params.albumId,
      buyerEmail: PLANTILLA_EMAIL,
      buyerName: "Link compartido de regalo",
      status: OrderStatus.PAID,
      totalCents: 0,
      platformCommissionCents: 0,
      origin: OrderOrigin.PREVENTA_PACK,
      checkoutPaymentSource: CheckoutPaymentSource.PREPAID_PACK,
      redemptionPaymentRefsJson: refs as unknown as Prisma.InputJsonValue,
    },
    select: { id: true },
  });
  const token = await createPackAccessTokenForOrder(order.id, { ttlDays: params.ttlDays });
  if (!token) throw new Error(`No se pudo crear el link compartido del pedido ${order.id}`);
  return { orderId: order.id, token: token.token, expiresAt: token.expiresAt };
}
