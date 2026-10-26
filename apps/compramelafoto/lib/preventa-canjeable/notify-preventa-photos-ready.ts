/**
 * Aviso "ya están las fotos" a las familias que compraron en preventa y todavía no canjearon.
 *
 * Sin esto la familia sólo tenía el link del correo de compra, de semanas atrás, y nadie le
 * avisaba que las fotos se habían publicado. Lo dispara el fotógrafo con un botón, no la
 * primera foto subida: las fotos suelen subirse en tandas y avisar con la primera hace
 * entrar a familias que todavía no encuentran las suyas.
 *
 * Cada correo lleva un link nuevo (los tokens se guardan hasheados, el viejo no se puede
 * releer) y no revoca los anteriores: el link del correo de compra sigue sirviendo.
 */

import { OrderOrigin, OrderStatus, Prisma, prisma } from "@/lib/prisma";
import { queueEmail } from "@/lib/email-queue";
import { createPackAccessTokenForOrder } from "./pack-access-tokens";
import { parsePreCompraOrderIdFromPaymentRef } from "./preventa-redeem-url";
import { studentNameForGreeting } from "./preventa-canje-slots";
import { isPlaceholderEmail } from "@/lib/canje-externo/external-preventa";
import { AVISO_FOTOS_LISTAS_KEY as AVISO_REF_KEY } from "./aviso-fotos-listas";

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;"
  );
}

export function buildPhotosReadyEmail(input: {
  buyerName: string | null;
  studentName: string | null;
  albumTitle: string;
  photographerName: string | null;
  packName: string;
  canjeUrl: string;
}): { subject: string; text: string; html: string } {
  const hola = input.buyerName?.trim() ? `Hola ${input.buyerName.trim().split(/\s+/)[0]}` : "Hola";
  const de = input.studentName?.trim() ? ` de ${input.studentName.trim()}` : "";
  const quien = input.photographerName?.trim() || "El fotógrafo";
  const subject = `Ya están las fotos: elegí las de tu pack (${input.albumTitle})`;
  const text = `${hola},

${quien} ya publicó las fotos de ${input.albumTitle}.

Tu pack${de} ("${input.packName}") ya está pago. Entrá a este link, elegí las fotos que incluye y confirmá. No vas a pagar nada:
${input.canjeUrl}

El link es personal: no lo compartas.

ComprameLaFoto`;
  const html = `<div style="font-family: Arial, sans-serif; color: #1f2328; line-height: 1.5; max-width: 560px;">
<p>${escapeHtml(hola)},</p>
<p>${escapeHtml(quien)} ya publicó las fotos de <strong>${escapeHtml(input.albumTitle)}</strong>.</p>
<p>Tu pack${escapeHtml(de)} (<strong>${escapeHtml(input.packName)}</strong>) ya está pago. Elegí las fotos que incluye y confirmá. No vas a pagar nada.</p>
<p style="margin: 28px 0;"><a href="${escapeHtml(input.canjeUrl)}" style="background: #c27b3d; color: #ffffff; padding: 14px 22px; border-radius: 10px; text-decoration: none; font-weight: bold;">Elegir las fotos de mi pack</a></p>
<p style="font-size: 13px; color: #6b6f76;">El link es personal: no lo compartas.</p>
<p>ComprameLaFoto</p>
</div>`;
  return { subject, text, html };
}

/**
 * Packs pendientes de canje del álbum. Con `orderIds`, sólo esos: así se avisa a un curso (las
 * fotos se suben curso por curso y avisarle a todo el colegio hace entrar a familias cuyas
 * fotos todavía no están).
 */
export function pendingWhere(albumId: number, orderIds?: readonly number[] | null): Prisma.OrderWhereInput {
  return {
    albumId,
    origin: OrderOrigin.PREVENTA_PACK,
    status: OrderStatus.PAID,
    isTest: false,
    redemptionOrderId: null,
    ...(orderIds ? { id: { in: [...orderIds] } } : {}),
  };
}

/** Los ids que manda el panel: enteros positivos, sin repetir. `null` si no mandó la lista. */
export function parseAvisoOrderIds(raw: unknown): number[] | null {
  if (!Array.isArray(raw)) return null;
  return [...new Set(raw.filter((n): n is number => Number.isInteger(n) && (n as number) > 0))];
}

export type PhotosReadyStatus = {
  pendientes: number;
  canjeados: number;
  ultimoAvisoAt: string | null;
};

export async function getPreventaPhotosReadyStatus(albumId: number): Promise<PhotosReadyStatus> {
  const [pendientes, canjeados, conAviso] = await Promise.all([
    prisma.order.count({ where: pendingWhere(albumId) }),
    prisma.order.count({
      where: {
        albumId,
        origin: OrderOrigin.PREVENTA_PACK,
        status: OrderStatus.PAID,
        isTest: false,
        redemptionOrderId: { not: null },
      },
    }),
    prisma.order.findMany({
      where: { ...pendingWhere(albumId), redemptionPaymentRefsJson: { path: [AVISO_REF_KEY], not: Prisma.AnyNull } },
      select: { redemptionPaymentRefsJson: true },
    }),
  ]);
  let ultimo: string | null = null;
  for (const o of conAviso) {
    const v = (o.redemptionPaymentRefsJson as Record<string, unknown> | null)?.[AVISO_REF_KEY];
    if (typeof v === "string" && (!ultimo || v > ultimo)) ultimo = v;
  }
  return { pendientes, canjeados, ultimoAvisoAt: ultimo };
}

/** Los packs cobrados por fuera no tienen email real hasta que la familia canjea. */
function tieneEmailReal(email: string | null): email is string {
  return Boolean(email?.includes("@")) && !isPlaceholderEmail(email);
}

/**
 * A cuántas familias pendientes les llegaría el aviso (`conEmail`) y cuántas quedan afuera
 * por no tener email real (`sinEmail`, packs cobrados por fuera). Mismo criterio que
 * `notifyPreventaPhotosReady`: sirve para decir el número antes de mandar.
 */
export async function countPreventaPhotosReadyRecipients(
  albumId: number
): Promise<{ conEmail: number; sinEmail: number }> {
  const orders = await prisma.order.findMany({
    where: pendingWhere(albumId),
    select: { buyerEmail: true },
  });
  let conEmail = 0;
  for (const o of orders) if (tieneEmailReal(o.buyerEmail)) conEmail++;
  return { conEmail, sinEmail: orders.length - conEmail };
}

export async function notifyPreventaPhotosReady(params: {
  albumId: number;
  baseUrl: string;
  now?: Date;
  /** Sólo estos packs (p. ej. los de un curso). Sin la lista, todos los pendientes del álbum. */
  orderIds?: readonly number[] | null;
}): Promise<{ enviados: number; sinEmail: number }> {
  if (params.orderIds && params.orderIds.length === 0) return { enviados: 0, sinEmail: 0 };
  const now = params.now ?? new Date();
  const album = await prisma.album.findUnique({
    where: { id: params.albumId },
    select: { title: true, user: { select: { name: true } } },
  });
  if (!album) return { enviados: 0, sinEmail: 0 };

  const orders = await prisma.order.findMany({
    where: pendingWhere(params.albumId, params.orderIds),
    select: {
      id: true,
      buyerEmail: true,
      buyerName: true,
      preCompraPaymentRef: true,
      preventaPackSnapshotJson: true,
      redemptionPaymentRefsJson: true,
    },
    orderBy: { id: "asc" },
  });

  const dia = now.toISOString().slice(0, 10);
  let enviados = 0;
  let sinEmail = 0;
  const avisar = async (o: (typeof orders)[number]) => {
    // Los packs cobrados por fuera no tienen email hasta que la familia canjea: a esos les
    // llega el link por el chat de la fotógrafa (panel Canjes), no por correo.
    if (!tieneEmailReal(o.buyerEmail)) {
      sinEmail++;
      return;
    }
    const tok = await createPackAccessTokenForOrder(o.id, { revokeExisting: false });
    if (!tok?.token) return;

    const preCompraId = parsePreCompraOrderIdFromPaymentRef(o.preCompraPaymentRef);
    const pc = preCompraId
      ? await prisma.preCompraOrder.findUnique({
          where: { id: preCompraId },
          select: { studentFirstName: true, studentLastName: true },
        })
      : null;
    const snap = o.preventaPackSnapshotJson as { packName?: unknown } | null;
    const { subject, text, html } = buildPhotosReadyEmail({
      buyerName: o.buyerName,
      studentName: studentNameForGreeting(
        [pc?.studentFirstName, pc?.studentLastName].filter(Boolean).join(" "),
        o.buyerName
      ),
      albumTitle: album.title,
      photographerName: album.user?.name ?? null,
      packName: typeof snap?.packName === "string" ? snap.packName : "tu pack",
      canjeUrl: `${params.baseUrl}/canje/preventa/${tok.token}`,
    });

    await queueEmail({
      to: o.buyerEmail,
      subject,
      body: text,
      htmlBody: html,
      // Un aviso por pedido y por día: un doble clic no duplica correos.
      idempotencyKey: `preventa_fotos_listas_${o.id}_${dia}`,
    });
    await prisma.order.update({
      where: { id: o.id },
      data: {
        redemptionPaymentRefsJson: {
          ...((o.redemptionPaymentRefsJson as Record<string, unknown> | null) ?? {}),
          [AVISO_REF_KEY]: now.toISOString(),
        } as Prisma.InputJsonValue,
      },
    });
    enviados++;
  };
  // De a varias en paralelo: de a una, 120 familias tardaban ~3 minutos y el pedido del
  // botón podía cortarse por tiempo antes de terminar.
  const TANDA = 8;
  for (let i = 0; i < orders.length; i += TANDA) {
    await Promise.all(orders.slice(i, i + TANDA).map(avisar));
  }
  return { enviados, sinEmail };
}
