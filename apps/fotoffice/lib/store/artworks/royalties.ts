/**
 * Regalías de autores: lectura del mes, "a recuperar" y "Marcar pagado" (spec O11, §5.9).
 * Todo con `workspaceId`. Lo puro (meses, agrupado, CSV) está en `royalty-report.ts`.
 *
 * El email del autor se muestra a quien configura la tienda: es quien le tiene que pagar.
 * Nunca va a los logs.
 */
import "server-only";

import { prisma, type Prisma } from "@repo/db";

import { decimalArsToMinor } from "@/lib/membership/money";

import {
  arMonthRange,
  authorName,
  groupRoyaltiesByAuthor,
  parsePaidReference,
  type AuthorPerson,
  type AuthorRoyalties,
  type RoyaltyRow,
} from "./royalty-report";

const MES = /^\d{4}-(0[1-9]|1[0-2])$/;

const SELECT_REGALIA = {
  id: true,
  authorUserId: true,
  orderId: true,
  baseArs: true,
  royaltyBps: true,
  amountArs: true,
  status: true,
  createdAt: true,
  paidAt: true,
  paidReference: true,
  order: { select: { orderNumber: true, status: true } },
  orderItem: { select: { productName: true, printFormatName: true, qty: true } },
} satisfies Prisma.ArtworkRoyaltySelect;

type RegaliaDb = Prisma.ArtworkRoyaltyGetPayload<{ select: typeof SELECT_REGALIA }>;

function aFila(r: RegaliaDb): RoyaltyRow {
  return {
    id: r.id,
    authorUserId: r.authorUserId,
    orderId: r.orderId,
    orderNumber: r.order.orderNumber,
    orderStatus: r.order.status,
    workTitle: r.orderItem.productName,
    formatName: r.orderItem.printFormatName,
    qty: r.orderItem.qty,
    baseMinor: decimalArsToMinor(r.baseArs),
    royaltyBps: r.royaltyBps,
    amountMinor: decimalArsToMinor(r.amountArs),
    status: r.status,
    createdAt: r.createdAt,
    paidAt: r.paidAt,
    paidReference: r.paidReference,
  };
}

/** Nombre: el visible de FotoRank; si no, el de la cuenta. */
async function personas(ids: number[]): Promise<Map<number, AuthorPerson>> {
  const unicos = [...new Set(ids)];
  if (unicos.length === 0) return new Map();
  const users = await prisma.user.findMany({
    where: { id: { in: unicos } },
    select: { id: true, name: true, email: true, fotorankProfile: { select: { displayName: true } } },
  });
  return new Map(
    users.map((u) => [u.id, { name: u.fotorankProfile?.displayName?.trim() || u.name || null, email: u.email ?? null }]),
  );
}

export async function loadRoyaltyMonth(workspaceId: string, month: string): Promise<AuthorRoyalties[]> {
  const { start, end } = arMonthRange(month);
  const regalias = await prisma.artworkRoyalty.findMany({
    where: { workspaceId, createdAt: { gte: start, lt: end } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: SELECT_REGALIA,
  });
  const filas = regalias.map(aFila);
  return groupRoyaltiesByAuthor(filas, await personas(filas.map((f) => f.authorUserId)));
}

export type RoyaltyToRecover = RoyaltyRow & { authorName: string; authorEmail: string | null };

/** Regalías ya pagadas de pedidos que después se cancelaron: la plata está del lado del autor. */
export async function loadRoyaltiesToRecover(workspaceId: string): Promise<RoyaltyToRecover[]> {
  const regalias = await prisma.artworkRoyalty.findMany({
    where: { workspaceId, status: "PAID", order: { status: "CANCELLED" } },
    orderBy: [{ paidAt: "asc" }, { id: "asc" }],
    select: SELECT_REGALIA,
  });
  const filas = regalias.map(aFila);
  const gente = await personas(filas.map((f) => f.authorUserId));
  return filas.map((f) => ({
    ...f,
    authorName: authorName(f.authorUserId, gente.get(f.authorUserId)),
    authorEmail: gente.get(f.authorUserId)?.email ?? null,
  }));
}

export type MarkPaidResult = { ok: true; count: number } | { ok: false; error: string };

/**
 * Marca pagadas las regalías A PAGAR de un autor en un mes. El `where` con `status: "ACCRUED"`
 * decide en la base: nunca pisa una anulada (pedido cancelado) ni una ya pagada (con su
 * referencia), aunque la cancelación ocurra en paralelo.
 */
export async function markAuthorMonthPaid(input: {
  workspaceId: string;
  authorUserId: number;
  month: string;
  reference: unknown;
  userId: number;
  now?: Date;
}): Promise<MarkPaidResult> {
  if (!Number.isInteger(input.authorUserId) || input.authorUserId <= 0) {
    return { ok: false, error: "Falta el autor." };
  }
  if (!MES.test(input.month)) return { ok: false, error: "El mes no es válido." };
  const referencia = parsePaidReference(input.reference);
  if (!referencia.ok) return referencia;

  const { start, end } = arMonthRange(input.month);
  const { count } = await prisma.artworkRoyalty.updateMany({
    where: {
      workspaceId: input.workspaceId,
      authorUserId: input.authorUserId,
      status: "ACCRUED",
      createdAt: { gte: start, lt: end },
    },
    data: {
      status: "PAID",
      paidAt: input.now ?? new Date(),
      paidReference: referencia.value,
      paidByUserId: input.userId,
    },
  });
  if (count === 0) return { ok: false, error: "Este autor no tiene regalías a pagar en ese mes." };
  return { ok: true, count };
}
