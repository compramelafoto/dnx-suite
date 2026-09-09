import "server-only";
import { prisma } from "@repo/db";
import { DRAND_DEFAULT_CHAIN_HASH, type RaffleStatus } from "./constants";
import { fetchChainInfo, roundAfter } from "./drand";
import { recordRaffleEvent } from "./events";
import { canAnnounce } from "./lifecycle";

/**
 * Anunciar: el paso que fija de dónde va a salir el número.
 *
 * Acá se consulta `/info` de la cadena —génesis y período— y se guarda el `chainHash` junto
 * con la primera tanda estrictamente posterior al acto. Los parámetros se leen del servicio y
 * no se fijan en el código: si la cadena cambiara, un número escrito a mano dejaría de
 * verificar.
 *
 * Lo que NO se guarda acá es el valor del azar: todavía no existe. Ese es todo el punto.
 */

export type AnnounceResult = { ok: true; round: number } | { ok: false; error: string };

export async function announceRaffle(input: {
  workspaceId: string;
  raffleId: string;
  actorUserId: number;
  actorLabel: string;
  now?: Date;
}): Promise<AnnounceResult> {
  const now = input.now ?? new Date();

  const sorteo = await prisma.raffle.findFirst({
    where: { id: input.raffleId, workspaceId: input.workspaceId },
    select: {
      id: true,
      status: true,
      entriesCloseAt: true,
      drawsAt: true,
      _count: { select: { prizes: true } },
    },
  });
  if (!sorteo) return { ok: false, error: "Ese sorteo no existe." };

  const permiso = canAnnounce({
    status: sorteo.status as RaffleStatus,
    prizeCount: sorteo._count.prizes,
    entriesCloseAt: sorteo.entriesCloseAt,
    drawsAt: sorteo.drawsAt,
    now,
  });
  if (!permiso.ok) return permiso;

  let info;
  try {
    info = await fetchChainInfo(DRAND_DEFAULT_CHAIN_HASH);
  } catch {
    return {
      ok: false,
      error:
        "No se pudo leer drand en este momento. Sin la tanda fijada no se anuncia, porque es lo que hace verificable el sorteo. Probá de nuevo en un rato.",
    };
  }

  const round = roundAfter(info, sorteo.drawsAt);

  await prisma.$transaction(async (tx) => {
    await tx.raffle.update({
      where: { id: sorteo.id },
      data: {
        status: "ANUNCIADO",
        drandChainHash: info.chainHash,
        drandRound: round,
        announcedByUserId: input.actorUserId,
      },
    });
    await recordRaffleEvent(tx, {
      raffleId: sorteo.id,
      type: "ANUNCIADO",
      actorUserId: input.actorUserId,
      actorLabel: input.actorLabel,
      note: `Tanda de drand fijada: ${round}.`,
    });
  });

  return { ok: true, round };
}
