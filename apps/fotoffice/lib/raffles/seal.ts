import "server-only";
import { prisma } from "@repo/db";
import type { RaffleStatus } from "./constants";
import { entrantsHash as calcularHuella, orderEntrants } from "./entrants";
import { selectEntrants } from "./eligibility";
import { recordRaffleEvent } from "./events";
import { canSeal } from "./lifecycle";
import { loadMembersForRaffle } from "./repository";

/**
 * El sellado del padrón: el momento anterior al acto en el que la lista se congela.
 *
 * ── Por qué es un momento distinto del sorteo ──
 *
 * Si el padrón se congelara en el mismo instante del acto, quedaría una ventana de
 * manipulación: entre que sale el valor de drand y que alguien resuelve el sorteo, un
 * administrador que ya vio el número podría alterar el estado de deuda de un socio y cambiar
 * quién está en la lista. El sellado ocurre —y se puede demostrar que ocurrió— ANTES de que
 * el número exista.
 *
 * La deuda se mide contra `entriesCloseAt` y nunca contra el momento en que esta función
 * corre. Si no fuera así, un sellado que se hace tarde produciría un padrón distinto del que
 * se le prometió al socio.
 *
 * Es idempotente: sellar dos veces devuelve el mismo resultado y no reescribe nada. Se
 * dispara de dos maneras —la tarea programada y la primera visita posterior al cierre—
 * porque un sorteo no puede quedar sin sellar por una tarea que no corrió.
 */

export type SealResult =
  | { ok: true; entrantsCount: number; entrantsHash: string; alreadySealed: boolean }
  | { ok: false; error: string };

export async function sealRaffle(input: {
  workspaceId: string;
  raffleId: string;
  actorUserId?: number | null;
  actorLabel?: string | null;
  now?: Date;
}): Promise<SealResult> {
  const now = input.now ?? new Date();

  const sorteo = await prisma.raffle.findFirst({
    where: { id: input.raffleId, workspaceId: input.workspaceId },
    select: {
      id: true,
      status: true,
      entriesCloseAt: true,
      entrantsHash: true,
      entrantsCount: true,
      _count: { select: { prizes: true } },
    },
  });
  if (!sorteo) return { ok: false, error: "Ese sorteo no existe." };

  // Ya sellado: no es un error. Es la respuesta correcta a la segunda llamada.
  if (sorteo.entrantsHash !== null && sorteo.entrantsCount !== null) {
    return {
      ok: true,
      alreadySealed: true,
      entrantsCount: sorteo.entrantsCount,
      entrantsHash: sorteo.entrantsHash,
    };
  }

  const socios = await loadMembersForRaffle(input.workspaceId);
  const participantes = orderEntrants(selectEntrants(socios, sorteo.entriesCloseAt));

  const permiso = canSeal({
    status: sorteo.status as RaffleStatus,
    entriesCloseAt: sorteo.entriesCloseAt,
    now,
    entrantCount: participantes.length,
    prizeCount: sorteo._count.prizes,
  });
  if (!permiso.ok) return permiso;

  const huella = calcularHuella(sorteo.id, participantes);

  await prisma.$transaction(async (tx) => {
    await tx.raffleEntry.createMany({
      data: participantes.map((e) => ({
        raffleId: sorteo.id,
        memberId: e.memberId,
        position: e.position,
        memberNumberSnapshot: e.memberNumber,
        fullNameSnapshot: e.fullName,
      })),
      skipDuplicates: true,
    });
    await tx.raffle.update({
      where: { id: sorteo.id },
      data: {
        status: "PADRON_SELLADO",
        entrantsHash: huella,
        entrantsCount: participantes.length,
        sealedAt: now,
      },
    });
    await recordRaffleEvent(tx, {
      raffleId: sorteo.id,
      type: "PADRON_SELLADO",
      actorUserId: input.actorUserId ?? null,
      actorLabel: input.actorLabel ?? null,
      note: `${participantes.length} participantes. Huella ${huella}.`,
    });
  });

  return {
    ok: true,
    alreadySealed: false,
    entrantsCount: participantes.length,
    entrantsHash: huella,
  };
}

/**
 * Sella todos los sorteos cuyo padrón ya cerró. La usa la tarea programada.
 *
 * Un sorteo que no se puede sellar —nadie al día, menos participantes que premios— no
 * interrumpe a los demás: queda anotado y la Secretaría lo ve en la pantalla.
 */
export async function sealDueRaffles(
  now: Date = new Date(),
): Promise<{ sellados: number; fallados: { raffleId: string; error: string }[] }> {
  const pendientes = await prisma.raffle.findMany({
    where: { status: "ANUNCIADO", entriesCloseAt: { lte: now } },
    select: { id: true, workspaceId: true },
  });

  let sellados = 0;
  const fallados: { raffleId: string; error: string }[] = [];

  for (const p of pendientes) {
    const r = await sealRaffle({ workspaceId: p.workspaceId, raffleId: p.id, now });
    if (r.ok) sellados += 1;
    else fallados.push({ raffleId: p.id, error: r.error });
  }

  return { sellados, fallados };
}
