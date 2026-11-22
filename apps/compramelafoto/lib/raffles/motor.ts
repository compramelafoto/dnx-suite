import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { queueEmail } from "@/lib/email-queue";
import { esCorreoDePrueba } from "@/lib/demos/identidad";
import { DRAND_DEFAULT_CHAIN_HASH, type RafflePrizeStatus, type RaffleStatus } from "./constants";
import { fetchChainInfo, fetchRound, roundAfter } from "./drand";
import { drawWinners } from "./draw";
import { monthName, monthlyWindow, periodOf } from "./fechas";
import {
  canAnnounce,
  canCancel,
  canDraw,
  canEditDraft,
  canSeal,
  isRaffleClosed,
  nextPrizeStatus,
  validateDates,
} from "./lifecycle";
import { parsePrizeTemplates, winnerEmail, type PrizeTemplate } from "./mensajes";
import { entrantsHash, orderEntrants } from "./padron";
import { computeEntrants, loadSettings } from "./repository";

/**
 * El ciclo de vida del sorteo: crear, anunciar, cerrar el padrón, sortear, avisar, entregar.
 *
 * Mismo orden y mismas garantías que FOTOFFICE (`apps/fotoffice/lib/raffles`):
 * - al ANUNCIAR se fija la tanda de drand, la primera posterior al acto;
 * - al CERRAR EL PADRÓN (cuando termina el período de ventas) se congela la lista y se publica
 *   su huella, antes de que exista el número;
 * - al SORTEAR se lee drand y se resuelve con una cuenta pura que cualquiera puede rehacer.
 *
 * Todo es idempotente: la tarea programada puede pasar dos veces sin duplicar nada.
 */

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string; waiting?: boolean };

type Actor = { userId: number | null; label: string | null };
const SISTEMA: Actor = { userId: null, label: "Sistema" };

async function recordEvent(
  tx: Prisma.TransactionClient,
  input: { raffleId: string; type: string; actor: Actor; note?: string | null; prizeId?: string | null },
) {
  await tx.clfRaffleEvent.create({
    data: {
      raffleId: input.raffleId,
      type: input.type,
      actorUserId: input.actor.userId,
      actorLabel: input.actor.label,
      note: input.note ?? null,
      prizeId: input.prizeId ?? null,
    },
  });
}

function prizeData(p: PrizeTemplate) {
  return {
    title: p.title,
    description: p.description ?? null,
    conditions: p.conditions ?? null,
    sponsorName: p.sponsorName ?? null,
    deliveryInstructions: p.deliveryInstructions ?? null,
    estimatedValueArs: p.estimatedValueArs ?? null,
  };
}

// ─── Crear y editar ───────────────────────────────────────────────────────────────────────

export async function createRaffle(input: {
  title: string;
  description?: string | null;
  kind: "MANUAL" | "MENSUAL";
  period?: string | null;
  salesFrom: Date;
  salesTo: Date;
  minSales: number;
  entriesCloseAt: Date;
  drawsAt: Date;
  prizes?: PrizeTemplate[];
  actor: Actor;
}): Promise<Result<{ id: string }>> {
  const title = input.title.trim();
  if (!title) return { ok: false, error: "Poné un nombre al sorteo." };
  const fechas = validateDates(input);
  if (!fechas.ok) return fechas;
  const minSales = Math.max(1, Math.trunc(input.minSales || 1));

  const creado = await prisma.$transaction(async (tx) => {
    const r = await tx.clfRaffle.create({
      data: {
        title,
        description: input.description?.trim() || null,
        kind: input.kind,
        period: input.period ?? null,
        salesFrom: input.salesFrom,
        salesTo: input.salesTo,
        minSales,
        entriesCloseAt: input.entriesCloseAt,
        drawsAt: input.drawsAt,
        createdByUserId: input.actor.userId,
        prizes: {
          create: (input.prizes ?? []).map((p, i) => ({ order: i + 1, ...prizeData(p) })),
        },
      },
      select: { id: true },
    });
    await recordEvent(tx, { raffleId: r.id, type: "CREADO", actor: input.actor });
    return r;
  });
  return { ok: true, id: creado.id };
}

export async function updateDraft(
  raffleId: string,
  input: {
    title?: string;
    description?: string | null;
    salesFrom?: Date;
    salesTo?: Date;
    minSales?: number;
    entriesCloseAt?: Date;
    drawsAt?: Date;
  },
): Promise<Result> {
  const r = await prisma.clfRaffle.findUnique({ where: { id: raffleId } });
  if (!r) return { ok: false, error: "Ese sorteo no existe." };
  if (!canEditDraft(r.status as RaffleStatus)) {
    return { ok: false, error: "Sólo se edita un sorteo en borrador." };
  }
  const next = {
    salesFrom: input.salesFrom ?? r.salesFrom,
    salesTo: input.salesTo ?? r.salesTo,
    entriesCloseAt: input.entriesCloseAt ?? r.entriesCloseAt,
    drawsAt: input.drawsAt ?? r.drawsAt,
  };
  const fechas = validateDates(next);
  if (!fechas.ok) return fechas;
  const title = input.title?.trim();
  await prisma.clfRaffle.update({
    where: { id: raffleId },
    data: {
      ...next,
      ...(title ? { title } : {}),
      ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
      ...(input.minSales !== undefined ? { minSales: Math.max(1, Math.trunc(input.minSales)) } : {}),
    },
  });
  return { ok: true };
}

export async function addPrize(raffleId: string, prize: PrizeTemplate): Promise<Result> {
  const r = await prisma.clfRaffle.findUnique({
    where: { id: raffleId },
    select: { status: true, prizes: { select: { order: true } } },
  });
  if (!r) return { ok: false, error: "Ese sorteo no existe." };
  if (!canEditDraft(r.status as RaffleStatus)) {
    return { ok: false, error: "Los premios se cargan antes de anunciar." };
  }
  if (!prize.title?.trim()) return { ok: false, error: "El premio necesita un nombre." };
  const order = r.prizes.reduce((m, p) => Math.max(m, p.order), 0) + 1;
  await prisma.clfRafflePrize.create({ data: { raffleId, order, ...prizeData(prize) } });
  return { ok: true };
}

export async function removePrize(prizeId: string): Promise<Result> {
  const p = await prisma.clfRafflePrize.findUnique({
    where: { id: prizeId },
    select: { raffle: { select: { status: true } } },
  });
  if (!p) return { ok: false, error: "Ese premio no existe." };
  if (!canEditDraft(p.raffle.status as RaffleStatus)) {
    return { ok: false, error: "Los premios se tocan antes de anunciar." };
  }
  await prisma.clfRafflePrize.delete({ where: { id: prizeId } });
  return { ok: true };
}

// ─── Anunciar y cancelar ──────────────────────────────────────────────────────────────────

export async function announceRaffle(raffleId: string, actor: Actor, now = new Date()): Promise<Result<{ round: number }>> {
  const r = await prisma.clfRaffle.findUnique({
    where: { id: raffleId },
    select: {
      id: true,
      status: true,
      salesFrom: true,
      salesTo: true,
      entriesCloseAt: true,
      drawsAt: true,
      _count: { select: { prizes: true } },
    },
  });
  if (!r) return { ok: false, error: "Ese sorteo no existe." };
  const permiso = canAnnounce({ ...r, status: r.status as RaffleStatus, prizeCount: r._count.prizes, now });
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
  // Al anunciar, los premios se renumeran 1..N (pudo haber huecos por premios borrados): el
  // orden entra en la cuenta del ganador y desde acá ya no cambia.
  const round = roundAfter(info, r.drawsAt);
  await prisma.$transaction(async (tx) => {
    const premios = await tx.clfRafflePrize.findMany({
      where: { raffleId },
      orderBy: { order: "asc" },
      select: { id: true, order: true },
    });
    // Renumerar en dos pasos para no chocar con el único (raffleId, order).
    for (const [i, p] of premios.entries()) {
      await tx.clfRafflePrize.update({ where: { id: p.id }, data: { order: 1000 + i } });
    }
    for (const [i, p] of premios.entries()) {
      await tx.clfRafflePrize.update({ where: { id: p.id }, data: { order: i + 1 } });
    }
    await tx.clfRaffle.update({
      where: { id: raffleId },
      data: {
        status: "ANUNCIADO",
        drandChainHash: info.chainHash,
        drandRound: round,
        announcedByUserId: actor.userId,
      },
    });
    await recordEvent(tx, { raffleId, type: "ANUNCIADO", actor, note: `Tanda de drand fijada: ${round}.` });
  });
  return { ok: true, round };
}

export async function cancelRaffle(raffleId: string, reason: string, actor: Actor): Promise<Result> {
  const r = await prisma.clfRaffle.findUnique({ where: { id: raffleId }, select: { status: true } });
  if (!r) return { ok: false, error: "Ese sorteo no existe." };
  const permiso = canCancel(r.status as RaffleStatus);
  if (!permiso.ok) return permiso;
  if (!reason.trim()) return { ok: false, error: "Cancelar exige escribir el motivo." };
  await prisma.$transaction(async (tx) => {
    await tx.clfRaffle.update({
      where: { id: raffleId },
      data: { status: "CANCELADO", cancelledAt: new Date(), cancelReason: reason.trim() },
    });
    await recordEvent(tx, { raffleId, type: "CANCELADO", actor, note: reason.trim() });
  });
  return { ok: true };
}

// ─── Cerrar el padrón ─────────────────────────────────────────────────────────────────────

export async function sealRaffle(
  raffleId: string,
  now = new Date(),
  actor: Actor = SISTEMA,
): Promise<Result<{ entrantsCount: number; entrantsHash: string; alreadySealed: boolean }>> {
  const r = await prisma.clfRaffle.findUnique({
    where: { id: raffleId },
    select: {
      id: true,
      status: true,
      salesFrom: true,
      salesTo: true,
      minSales: true,
      entriesCloseAt: true,
      entrantsHash: true,
      entrantsCount: true,
      _count: { select: { prizes: true } },
    },
  });
  if (!r) return { ok: false, error: "Ese sorteo no existe." };
  if (r.entrantsHash !== null && r.entrantsCount !== null) {
    return { ok: true, alreadySealed: true, entrantsCount: r.entrantsCount, entrantsHash: r.entrantsHash };
  }

  const ajustes = await loadSettings();
  const participantes = orderEntrants(
    await computeEntrants({
      salesFrom: r.salesFrom,
      salesTo: r.salesTo,
      minSales: r.minSales,
      excludedUserIds: ajustes.excludedUserIds,
    }),
  );
  const permiso = canSeal({
    status: r.status as RaffleStatus,
    entriesCloseAt: r.entriesCloseAt,
    now,
    entrantCount: participantes.length,
    prizeCount: r._count.prizes,
  });
  if (!permiso.ok) return permiso;

  const huella = entrantsHash(r.id, participantes);
  await prisma.$transaction(async (tx) => {
    await tx.clfRaffleEntry.createMany({
      data: participantes.map((e) => ({
        raffleId: r.id,
        userId: e.userId,
        position: e.position,
        codeSnapshot: e.code,
        displayNameSnapshot: e.displayName,
        salesCountSnapshot: e.salesCount,
      })),
      skipDuplicates: true,
    });
    await tx.clfRaffle.update({
      where: { id: r.id },
      data: { status: "PADRON_SELLADO", entrantsHash: huella, entrantsCount: participantes.length, sealedAt: now },
    });
    await recordEvent(tx, {
      raffleId: r.id,
      type: "PADRON_SELLADO",
      actor,
      note: `${participantes.length} participantes. Huella ${huella}.`,
    });
  });
  return { ok: true, alreadySealed: false, entrantsCount: participantes.length, entrantsHash: huella };
}

// ─── Sortear ──────────────────────────────────────────────────────────────────────────────

export async function resolveRaffle(
  raffleId: string,
  now = new Date(),
  actor: Actor = SISTEMA,
): Promise<Result<{ alreadyDrawn: boolean }>> {
  const r = await prisma.clfRaffle.findUnique({
    where: { id: raffleId },
    select: {
      id: true,
      status: true,
      drawsAt: true,
      entrantsHash: true,
      drandChainHash: true,
      drandRound: true,
      prizes: { orderBy: { order: "asc" }, select: { id: true, order: true } },
      entries: { orderBy: { position: "asc" }, select: { id: true, userId: true, position: true } },
    },
  });
  if (!r) return { ok: false, error: "Ese sorteo no existe." };
  if (r.status === "SORTEADO" || r.status === "CERRADO") return { ok: true, alreadyDrawn: true };

  const permiso = canDraw({ status: r.status as RaffleStatus, drawsAt: r.drawsAt, now });
  if (!permiso.ok) return permiso;
  if (!r.entrantsHash || !r.drandChainHash || r.drandRound === null) {
    return { ok: false, error: "A este sorteo le falta la huella del padrón o la tanda de drand." };
  }

  let tanda;
  try {
    tanda = await fetchRound(r.drandChainHash, r.drandRound);
  } catch (error) {
    const detalle = error instanceof Error ? error.message : String(error);
    if (detalle.includes("todavía no")) {
      return {
        ok: false,
        waiting: true,
        error: `Esperando el número de la tanda ${r.drandRound}. El resultado ya está determinado: se conoce en cuanto drand lo publique.`,
      };
    }
    return { ok: false, error: `No se pudo leer drand: ${detalle}` };
  }

  const resultados = drawWinners({
    entrantsHash: r.entrantsHash,
    round: r.drandRound,
    randomness: tanda.randomness,
    prizeOrders: r.prizes.map((p) => p.order),
    entrantCount: r.entries.length,
  });
  const porOrden = new Map(r.prizes.map((p) => [p.order, p.id]));
  const porPosicion = new Map(r.entries.map((e) => [e.position, e]));
  const filas = resultados.map((x) => {
    const entrada = porPosicion.get(x.winnerPosition);
    const prizeId = porOrden.get(x.prizeOrder);
    if (!entrada || !prizeId) throw new Error("El padrón cerrado no coincide con el resultado. No se escribe nada.");
    return {
      prizeId,
      raffleId: r.id,
      userId: entrada.userId,
      entryId: entrada.id,
      winnerPosition: x.winnerPosition,
      status: "GANADO",
    };
  });

  await prisma.$transaction(async (tx) => {
    await tx.clfRaffleAward.createMany({ data: filas, skipDuplicates: true });
    await tx.clfRaffle.update({
      where: { id: r.id },
      data: {
        status: "SORTEADO",
        drandRandomness: tanda.randomness,
        drandSignature: tanda.signature,
        drawnAt: now,
      },
    });
    await recordEvent(tx, {
      raffleId: r.id,
      type: "SORTEADO",
      actor,
      note: `Tanda ${r.drandRound}. Valor ${tanda.randomness}.`,
    });
  });
  return { ok: true, alreadyDrawn: false };
}

// ─── Avisar al ganador ────────────────────────────────────────────────────────────────────

/** Encola el correo a cada ganador todavía sin avisar. Idempotente por premio. */
export async function notifyWinners(raffleId: string): Promise<{ avisados: number; fallados: number }> {
  const awards = await prisma.clfRaffleAward.findMany({
    where: { raffleId, status: "GANADO", notifiedAt: null },
    select: {
      id: true,
      userId: true,
      prize: {
        select: { title: true, description: true, sponsorName: true, deliveryInstructions: true },
      },
      raffle: { select: { id: true, title: true } },
    },
  });
  let avisados = 0;
  let fallados = 0;
  for (const a of awards) {
    const user = await prisma.user.findUnique({ where: { id: a.userId }, select: { email: true, name: true } });
    if (!user?.email || esCorreoDePrueba(user.email)) {
      fallados += 1;
      await prisma.clfRaffleAward.update({
        where: { id: a.id },
        data: { noticeError: "La cuenta no tiene un correo válido. Avisale por otro medio." },
      });
      continue;
    }
    const mail = winnerEmail({
      raffleId: a.raffle.id,
      raffleTitle: a.raffle.title,
      winnerName: user.name,
      prizeTitle: a.prize.title,
      prizeDescription: a.prize.description,
      sponsorName: a.prize.sponsorName,
      deliveryInstructions: a.prize.deliveryInstructions,
    });
    try {
      await prisma.$transaction(async (tx) => {
        await queueEmail(
          {
            to: user.email,
            subject: mail.subject,
            body: mail.text,
            htmlBody: mail.html,
            priority: 3,
            idempotencyKey: `clf-raffle-award:${a.id}`,
          },
          tx,
        );
        await tx.clfRaffleAward.update({
          where: { id: a.id },
          data: { status: "NOTIFICADO", notifiedAt: new Date(), noticeError: null },
        });
        await recordEvent(tx, {
          raffleId: a.raffle.id,
          type: "PREMIO_NOTIFICADO",
          actor: SISTEMA,
          prizeId: null,
          note: `Aviso por correo a la cuenta N.º ${a.userId}.`,
        });
      });
      avisados += 1;
    } catch (error) {
      fallados += 1;
      await prisma.clfRaffleAward.update({
        where: { id: a.id },
        data: { noticeError: error instanceof Error ? error.message.slice(0, 300) : "Error al encolar el correo." },
      });
    }
  }
  return { avisados, fallados };
}

// ─── Entregar ─────────────────────────────────────────────────────────────────────────────

const EVENTO_POR_ESTADO: Partial<Record<RafflePrizeStatus, string>> = {
  ENTREGADO: "PREMIO_ENTREGADO",
  NO_RETIRADO: "PREMIO_NO_RETIRADO",
  ANULADO: "PREMIO_ANULADO",
  NOTIFICADO: "PREMIO_NOTIFICADO",
};

export async function setAwardStatus(
  awardId: string,
  to: RafflePrizeStatus,
  note: string | null,
  actor: Actor,
): Promise<Result> {
  const a = await prisma.clfRaffleAward.findUnique({
    where: { id: awardId },
    select: { id: true, status: true, raffleId: true, prizeId: true },
  });
  if (!a) return { ok: false, error: "Ese premio no existe." };
  const permiso = nextPrizeStatus(a.status as RafflePrizeStatus, to, note);
  if (!permiso.ok) return permiso;
  await prisma.$transaction(async (tx) => {
    await tx.clfRaffleAward.update({
      where: { id: a.id },
      data: {
        status: to,
        ...(to === "ENTREGADO"
          ? { deliveredAt: new Date(), deliveredByUserId: actor.userId, deliveryNote: note?.trim() || null }
          : {}),
        ...(to === "NOTIFICADO" ? { notifiedAt: new Date() } : {}),
        ...(to === "ANULADO" ? { voidReason: note?.trim() || null } : {}),
        ...(to === "NO_RETIRADO" ? { deliveryNote: note?.trim() || null } : {}),
      },
    });
    await recordEvent(tx, {
      raffleId: a.raffleId,
      type: EVENTO_POR_ESTADO[to] ?? "PREMIO_ACTUALIZADO",
      actor,
      note: note?.trim() || null,
      prizeId: a.prizeId,
    });
    const estados = await tx.clfRaffleAward.findMany({ where: { raffleId: a.raffleId }, select: { status: true } });
    if (isRaffleClosed(estados.map((e) => e.status as RafflePrizeStatus))) {
      await tx.clfRaffle.update({ where: { id: a.raffleId }, data: { status: "CERRADO" } });
    }
  });
  return { ok: true };
}

// ─── El sorteo mensual ────────────────────────────────────────────────────────────────────

/**
 * Crea el sorteo del mes en curso si el automático está encendido y todavía no existe, y lo
 * anuncia solo si así está configurado y tiene premios. Único por `period`, así que correr dos
 * veces no lo duplica.
 */
export async function ensureMonthlyRaffle(now = new Date()): Promise<{ creado: string | null; anunciado: boolean; error?: string }> {
  const ajustes = await loadSettings();
  if (!ajustes.monthlyEnabled) return { creado: null, anunciado: false };
  const period = periodOf(now);
  const existente = await prisma.clfRaffle.findUnique({ where: { period }, select: { id: true } });
  if (existente) return { creado: null, anunciado: false };

  const ventana = monthlyWindow(period, ajustes.drawDay, ajustes.drawHour);
  const premios = parsePrizeTemplates(ajustes.monthlyPrizes);
  const mes = monthName(period);
  const creado = await createRaffle({
    title: `Sorteo de ${mes}`,
    description: `Participan todos los fotógrafos que vendan ${ajustes.minSales <= 1 ? "al menos una foto" : `al menos ${ajustes.minSales} veces`} en CompraMeLaFoto durante ${mes}.`,
    kind: "MENSUAL",
    period,
    ...ventana,
    minSales: ajustes.minSales,
    prizes: premios,
    actor: SISTEMA,
  }).catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : String(e) }));
  if (!creado.ok) return { creado: null, anunciado: false, error: creado.error };

  if (ajustes.autoAnnounce && premios.length > 0) {
    const anuncio = await announceRaffle(creado.id, SISTEMA, now);
    return { creado: creado.id, anunciado: anuncio.ok, error: anuncio.ok ? undefined : anuncio.error };
  }
  return { creado: creado.id, anunciado: false };
}

/** Lo que hace la tarea programada cada hora. Un sorteo que falla no frena a los demás. */
export async function runRafflesCron(now = new Date()) {
  const mensual = await ensureMonthlyRaffle(now).catch((e: unknown) => ({
    creado: null,
    anunciado: false,
    error: e instanceof Error ? e.message : String(e),
  }));

  const aSellar = await prisma.clfRaffle.findMany({
    where: { status: "ANUNCIADO", entriesCloseAt: { lte: now } },
    select: { id: true },
  });
  const sellado: { id: string; ok: boolean; error?: string }[] = [];
  for (const r of aSellar) {
    const x = await sealRaffle(r.id, now).catch((e: unknown) => ({ ok: false as const, error: String(e) }));
    sellado.push({ id: r.id, ok: x.ok, error: x.ok ? undefined : x.error });
  }

  const aSortear = await prisma.clfRaffle.findMany({
    where: { status: "PADRON_SELLADO", drawsAt: { lte: now } },
    select: { id: true },
  });
  const sorteado: { id: string; ok: boolean; error?: string }[] = [];
  for (const r of aSortear) {
    const x = await resolveRaffle(r.id, now).catch((e: unknown) => ({ ok: false as const, error: String(e) }));
    sorteado.push({ id: r.id, ok: x.ok, error: x.ok ? undefined : x.error });
  }

  const conGanadoresSinAviso = await prisma.clfRaffle.findMany({
    where: { status: "SORTEADO", awards: { some: { status: "GANADO", notifiedAt: null, noticeError: null } } },
    select: { id: true },
  });
  let avisados = 0;
  for (const r of conGanadoresSinAviso) avisados += (await notifyWinners(r.id)).avisados;

  return { mensual, sellado, sorteado, avisados };
}
