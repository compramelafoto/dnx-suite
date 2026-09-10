import "server-only";
import { prisma, Prisma } from "@repo/db";

/**
 * La historia del sorteo.
 *
 * Mismo criterio que `MemberCardEvent`: las decisiones se guardan, las derivaciones se
 * calculan. `actorLabel` es una instantánea del nombre al momento del hecho, porque la
 * historia tiene que seguir entendiéndose aunque esa persona cambie de nombre o su usuario
 * se elimine.
 *
 * Acepta un cliente de transacción para que el evento y el cambio que describe entren o
 * salgan juntos: un evento sin su hecho es peor que no tener evento.
 */

export type RaffleEventType =
  | "CREADO"
  | "ANUNCIADO"
  | "PADRON_SELLADO"
  | "SORTEADO"
  | "PREMIO_NOTIFICADO"
  | "PREMIO_ENTREGADO"
  | "PREMIO_NO_RETIRADO"
  | "PREMIO_ANULADO"
  | "CANCELADO";

type ClienteEscritura = Prisma.TransactionClient | typeof prisma;

export async function recordRaffleEvent(
  cliente: ClienteEscritura,
  input: {
    raffleId: string;
    type: RaffleEventType;
    actorUserId?: number | null;
    actorLabel?: string | null;
    note?: string | null;
    prizeId?: string | null;
  },
): Promise<void> {
  await cliente.raffleEvent.create({
    data: {
      raffleId: input.raffleId,
      type: input.type,
      actorUserId: input.actorUserId ?? null,
      actorLabel: input.actorLabel ?? null,
      note: input.note ?? null,
      prizeId: input.prizeId ?? null,
    },
  });
}
