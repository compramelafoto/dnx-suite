import "server-only";
import { prisma } from "@repo/db";
import type { FulfillmentState } from "./fulfillment";

/**
 * El tablero de emisión de carnets físicos.
 *
 * Muestra en qué punto está cada uno y quién lo movió. Es lo que permite responder "¿por qué
 * el mío todavía no está?" sin llamar por teléfono a nadie.
 */

export type CardBoardRow = {
  id: string;
  cardNumber: string;
  memberId: string;
  memberNumber: string;
  fullName: string;
  state: FulfillmentState;
  updatedAt: Date | null;
  issuedAt: Date;
  lastActorLabel: string | null;
  lastNote: string | null;
  /** Un aviso que no salió: la Secretaría tiene que verlo. */
  noticeError: string | null;
};

export type CardBoard = {
  rows: CardBoardRow[];
  counts: Record<FulfillmentState, number>;
};

const VACIO: Record<FulfillmentState, number> = {
  PENDIENTE_PAGO: 0,
  EN_COLA: 0,
  IMPRESO: 0,
  LISTO_PARA_RETIRAR: 0,
  ENVIADO: 0,
  ENTREGADO: 0,
  ANULADO: 0,
};

export async function loadCardBoard(
  workspaceId: string,
  filtro: { state?: FulfillmentState } = {},
): Promise<CardBoard> {
  const cards = await prisma.memberCard.findMany({
    where: {
      workspaceId,
      format: "PRINTED",
      ...(filtro.state ? { fulfillmentState: filtro.state } : {}),
    },
    select: {
      id: true,
      cardNumber: true,
      issuedAt: true,
      fulfillmentState: true,
      fulfillmentUpdatedAt: true,
      member: { select: { id: true, memberNumber: true, firstName: true, lastName: true } },
      events: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { note: true, noticeError: true, actorLabel: true },
      },
    },
    // Los más viejos primero: son los que llevan más tiempo esperando.
    orderBy: [{ fulfillmentUpdatedAt: "asc" }, { issuedAt: "asc" }],
    take: 300,
  });

  const counts = { ...VACIO };
  const todos = await prisma.memberCard.groupBy({
    by: ["fulfillmentState"],
    where: { workspaceId, format: "PRINTED" },
    _count: { _all: true },
  });
  for (const fila of todos) {
    if (fila.fulfillmentState) {
      counts[fila.fulfillmentState as FulfillmentState] = fila._count._all;
    }
  }

  const rows: CardBoardRow[] = cards.map((c) => {
    const ultimo = c.events[0];
    return {
      id: c.id,
      cardNumber: c.cardNumber,
      memberId: c.member.id,
      memberNumber: c.member.memberNumber,
      fullName: `${c.member.firstName} ${c.member.lastName}`.trim(),
      state: (c.fulfillmentState ?? "PENDIENTE_PAGO") as FulfillmentState,
      updatedAt: c.fulfillmentUpdatedAt,
      issuedAt: c.issuedAt,
      lastActorLabel: ultimo?.actorLabel ?? null,
      lastNote: ultimo?.note ?? null,
      noticeError: ultimo?.noticeError ?? null,
    };
  });

  return { rows, counts };
}

export type CardHistoryEntry = {
  id: string;
  fromState: FulfillmentState | null;
  toState: FulfillmentState;
  actorLabel: string | null;
  note: string | null;
  noticeSentAt: Date | null;
  noticeError: string | null;
  createdAt: Date;
};

/** La historia completa de un carnet, del primer paso al último. */
export async function loadCardHistory(
  workspaceId: string,
  cardId: string,
): Promise<CardHistoryEntry[]> {
  const eventos = await prisma.memberCardEvent.findMany({
    where: { cardId, card: { workspaceId } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      fromState: true,
      toState: true,
      note: true,
      noticeSentAt: true,
      noticeError: true,
      createdAt: true,
      actorLabel: true,
    },
  });

  return eventos.map((e) => ({
    id: e.id,
    fromState: (e.fromState ?? null) as FulfillmentState | null,
    toState: e.toState as FulfillmentState,
    actorLabel: e.actorLabel,
    note: e.note,
    noticeSentAt: e.noticeSentAt,
    noticeError: e.noticeError,
    createdAt: e.createdAt,
  }));
}
