import "server-only";
import { prisma } from "@repo/db";
import type { RaffleStatus } from "./constants";
import { drawWinners } from "./draw";
import { fetchRound } from "./drand";
import { recordRaffleEvent } from "./events";
import { canDraw } from "./lifecycle";

/**
 * El acto: se lee el número de drand y se resuelven los premios.
 *
 * Idempotente por diseño y por base. Si dos procesos llegan a la vez —la tarea programada y
 * alguien que abre la página— el `@unique` sobre `prizeId` impide el segundo resultado, y como
 * la extracción es determinística, el que gane la carrera escribe exactamente lo mismo que
 * habría escrito el otro. El resultado no depende de quién llegó primero.
 *
 * Si drand no responde todavía, no es una falla del sorteo: la tanda ya estaba fijada y el
 * resultado será idéntico cuando el valor se recupere. Por eso la espera se distingue del
 * error, y la pantalla dice "esperando el número de la tanda N" en vez de mostrar una falla.
 */

export type Award = { prizeId: string; memberId: string; winnerPosition: number };

export type ResolveResult =
  | { ok: true; alreadyDrawn: boolean; awards: Award[] }
  | { ok: false; error: string; waiting?: boolean };

export async function resolveRaffle(input: {
  workspaceId: string;
  raffleId: string;
  actorUserId?: number | null;
  actorLabel?: string | null;
  now?: Date;
}): Promise<ResolveResult> {
  const now = input.now ?? new Date();

  const sorteo = await prisma.raffle.findFirst({
    where: { id: input.raffleId, workspaceId: input.workspaceId },
    select: {
      id: true,
      status: true,
      drawsAt: true,
      drawnAt: true,
      pickupDays: true,
      entrantsHash: true,
      entrantsCount: true,
      drandChainHash: true,
      drandRound: true,
      drandRandomness: true,
      prizes: { orderBy: { order: "asc" }, select: { id: true, order: true } },
      entries: { orderBy: { position: "asc" }, select: { id: true, memberId: true, position: true } },
    },
  });
  if (!sorteo) return { ok: false, error: "Ese sorteo no existe." };

  // Ya resuelto: se devuelve lo que hay. No se recalcula ni se reescribe nada.
  if (sorteo.status === "SORTEADO" || sorteo.status === "CERRADO") {
    const yaHechos = await prisma.rafflePrizeAward.findMany({
      where: { raffleId: sorteo.id },
      select: { prizeId: true, memberId: true, winnerPosition: true },
    });
    return { ok: true, alreadyDrawn: true, awards: yaHechos };
  }

  const permiso = canDraw({ status: sorteo.status as RaffleStatus, drawsAt: sorteo.drawsAt, now });
  if (!permiso.ok) return permiso;

  if (!sorteo.entrantsHash || !sorteo.drandChainHash || sorteo.drandRound === null) {
    return { ok: false, error: "A este sorteo le falta la huella del padrón o la tanda de drand." };
  }

  let tanda;
  try {
    tanda = await fetchRound(sorteo.drandChainHash, sorteo.drandRound);
  } catch (error) {
    const detalle = error instanceof Error ? error.message : String(error);
    if (detalle.includes("todavía no")) {
      return {
        ok: false,
        waiting: true,
        error: `Esperando el número de la tanda ${sorteo.drandRound}. El resultado ya está determinado: se va a conocer en cuanto drand lo publique.`,
      };
    }
    return { ok: false, error: `No se pudo leer drand: ${detalle}` };
  }

  const resultados = drawWinners({
    entrantsHash: sorteo.entrantsHash,
    round: sorteo.drandRound,
    randomness: tanda.randomness,
    prizeOrders: sorteo.prizes.map((p) => p.order),
    entrantCount: sorteo.entries.length,
  });

  const porOrden = new Map(sorteo.prizes.map((p) => [p.order, p.id]));
  const porPosicion = new Map(sorteo.entries.map((e) => [e.position, e]));

  const filas = resultados.map((r) => {
    const entrada = porPosicion.get(r.winnerPosition);
    const prizeId = porOrden.get(r.prizeOrder);
    if (!entrada || !prizeId) {
      // No debería poder pasar: las posiciones salen del propio padrón. Si pasara, no se
      // escribe nada — un resultado a medias sería peor que ninguno.
      throw new Error("El padrón sellado no coincide con el resultado. No se escribe nada.");
    }
    return {
      prizeId,
      raffleId: sorteo.id,
      memberId: entrada.memberId,
      entryId: entrada.id,
      winnerPosition: r.winnerPosition,
      status: "GANADO",
    };
  });

  // El plazo de retiro arranca ahora y es el mismo para todos los premios del sorteo: así el
  // aliado sabe la fecha exacta desde el día uno, se le haya podido avisar al ganador o no.
  const venceElRetiro = new Date(now.getTime() + sorteo.pickupDays * 86_400_000);

  await prisma.$transaction(async (tx) => {
    // `skipDuplicates` con el único sobre `prizeId`: si otro proceso ya escribió, este no
    // pisa nada, y como la cuenta es determinística lo que hay es idéntico a lo que iba.
    await tx.rafflePrizeAward.createMany({ data: filas, skipDuplicates: true });
    await tx.rafflePrize.updateMany({
      where: { raffleId: sorteo.id, pickupDeadline: null },
      data: { pickupDeadline: venceElRetiro },
    });
    await tx.raffle.update({
      where: { id: sorteo.id },
      data: {
        status: "SORTEADO",
        drandRandomness: tanda.randomness,
        drandSignature: tanda.signature,
        drawnAt: now,
      },
    });
    await recordRaffleEvent(tx, {
      raffleId: sorteo.id,
      type: "SORTEADO",
      actorUserId: input.actorUserId ?? null,
      actorLabel: input.actorLabel ?? null,
      note: `Tanda ${sorteo.drandRound}. Valor ${tanda.randomness}.`,
    });
  });

  return {
    ok: true,
    alreadyDrawn: false,
    awards: filas.map((a) => ({
      prizeId: a.prizeId,
      memberId: a.memberId,
      winnerPosition: a.winnerPosition,
    })),
  };
}

/** Resuelve todos los sorteos cuyo acto ya pasó. La usa la tarea programada. */
export async function resolveDueRaffles(
  now: Date = new Date(),
): Promise<{ resueltos: number; esperando: number; fallados: { raffleId: string; error: string }[] }> {
  const pendientes = await prisma.raffle.findMany({
    where: { status: "PADRON_SELLADO", drawsAt: { lte: now } },
    select: { id: true, workspaceId: true },
  });

  let resueltos = 0;
  let esperando = 0;
  const fallados: { raffleId: string; error: string }[] = [];

  for (const p of pendientes) {
    const r = await resolveRaffle({ workspaceId: p.workspaceId, raffleId: p.id, now });
    if (r.ok) resueltos += 1;
    else if (r.waiting) esperando += 1;
    else fallados.push({ raffleId: p.id, error: r.error });
  }

  return { resueltos, esperando, fallados };
}
