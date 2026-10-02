import "server-only";
import { prisma } from "@repo/db";
import type { BolilleroPremio } from "@/components/raffles/bolillero";
import { resolveLogoUrl } from "./logo-url";
import { loadPartnerCards, type PartnerCard } from "./partners-live";
import type { PortalPrize } from "./portal";
import { resolveRaffle } from "./resolve";
import { nombrePublico } from "./public-name";

/**
 * Lo que se muestra de un sorteo en la página pública: la que se proyecta en el evento y se
 * comparte en redes.
 *
 * La ve cualquiera, sin cuenta. Por eso los ganadores salen con nombre e inicial del apellido
 * y número de socio, nunca el nombre completo: alcanza para reconocerse en el salón y no deja
 * el apellido de nadie indexado en internet.
 */

/** Los estados que se pueden mirar desde afuera. El borrador no existe para el público. */
const VISIBLES = ["ANUNCIADO", "PADRON_SELLADO", "SORTEADO", "CERRADO", "CANCELADO"];

export type PublicRaffleView = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  entriesCloseAt: Date;
  drawsAt: Date;
  entrantsCount: number | null;
  entrantsHash: string | null;
  drandChainHash: string | null;
  drandRound: number | null;
  cancelReason: string | null;
  prizes: PortalPrize[];
  /** Lo que necesita el bolillero. `null` mientras no hay resultado. */
  bolillero: { entrantLabels: string[]; prizes: BolilleroPremio[] } | null;
  /** El acto ya pasó y se está esperando el número público: se dice, no se inventa. */
  waiting: string | null;
};

export async function loadPublicRaffle(input: {
  workspaceId: string;
  raffleId: string;
  memberWord: string;
  now?: Date;
}): Promise<PublicRaffleView | null> {
  const ahora = input.now ?? new Date();

  // Si el acto ya pasó y la tarea programada todavía no lo resolvió, la visita lo resuelve.
  // Es idempotente y el resultado no depende de quién lo dispare: es la misma cuenta.
  let waiting: string | null = null;
  const pendiente = await prisma.raffle.findFirst({
    where: {
      id: input.raffleId,
      workspaceId: input.workspaceId,
      status: "PADRON_SELLADO",
      drawsAt: { lte: ahora },
    },
    select: { id: true },
  });
  if (pendiente) {
    const r = await resolveRaffle({ workspaceId: input.workspaceId, raffleId: input.raffleId, now: ahora });
    if (!r.ok && r.waiting) waiting = r.error;
  }

  const f = await prisma.raffle.findFirst({
    where: { id: input.raffleId, workspaceId: input.workspaceId, status: { in: VISIBLES } },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      entriesCloseAt: true,
      drawsAt: true,
      entrantsCount: true,
      entrantsHash: true,
      drandChainHash: true,
      drandRound: true,
      cancelReason: true,
      entries: {
        orderBy: { position: "asc" },
        select: {
          position: true,
          memberNumberSnapshot: true,
          fullNameSnapshot: true,
          member: { select: { firstName: true, lastName: true } },
        },
      },
      prizes: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          order: true,
          title: true,
          description: true,
          partnerId: true,
          partnerNameSnapshot: true,
          partnerLogoSnapshot: true,
          award: { select: { winnerPosition: true } },
        },
      },
    },
  });
  if (!f) return null;

  const resuelto = f.status === "SORTEADO" || f.status === "CERRADO";
  const aliados = resuelto ? new Map<string, PartnerCard>() : await loadPartnerCards(f.prizes.map((p) => p.partnerId));
  const base = process.env.PARTNERS_PUBLIC_URL ?? null;

  const porPosicion = new Map(f.entries.map((e) => [e.position, e]));
  const etiqueta = (posicion: number): string => {
    const e = porPosicion.get(posicion);
    if (!e) return "—";
    const nombre = nombrePublico(e.member?.firstName, e.member?.lastName, e.fullNameSnapshot);
    return `${nombre} · ${input.memberWord} N° ${e.memberNumberSnapshot}`;
  };

  const prizes: PortalPrize[] = f.prizes.map((p) => {
    const aliado = p.partnerId ? aliados.get(p.partnerId) : undefined;
    return {
      id: p.id,
      order: p.order,
      title: p.title,
      description: p.description,
      partnerName: aliado?.name ?? p.partnerNameSnapshot,
      partnerLogoUrl: aliado?.logoSrc ?? resolveLogoUrl(p.partnerLogoSnapshot, base),
      partnerInstagramUrl: aliado?.instagramUrl ?? null,
      partnerWebsiteUrl: aliado?.websiteUrl ?? null,
      winnerLabel: p.award ? etiqueta(p.award.winnerPosition) : null,
    };
  });

  const ganados = f.prizes.filter(
    (p): p is typeof p & { award: { winnerPosition: number } } => p.award !== null,
  );
  const bolillero =
    resuelto && ganados.length > 0
      ? {
          entrantLabels: f.entries.map((e) => e.memberNumberSnapshot),
          prizes: ganados.map((p) => {
            const vista = prizes.find((x) => x.id === p.id);
            return {
              prizeTitle: p.title,
              partnerName: vista?.partnerName ?? null,
              partnerLogoUrl: vista?.partnerLogoUrl ?? null,
              winnerPosition: p.award.winnerPosition,
              winnerLabel: etiqueta(p.award.winnerPosition),
            };
          }),
        }
      : null;

  return {
    id: f.id,
    title: f.title,
    description: f.description,
    status: f.status,
    entriesCloseAt: f.entriesCloseAt,
    drawsAt: f.drawsAt,
    entrantsCount: f.entrantsCount,
    entrantsHash: f.entrantsHash,
    drandChainHash: f.drandChainHash,
    drandRound: f.drandRound,
    cancelReason: f.cancelReason,
    prizes,
    bolillero,
    waiting,
  };
}

/**
 * El sorteo que conviene mostrar en la dirección corta `/w/<institución>/sorteos`: el que está
 * abierto, y si no hay, el último que se hizo.
 */
export async function findFeaturedPublicRaffleId(workspaceId: string): Promise<string | null> {
  const abierto = await prisma.raffle.findFirst({
    where: { workspaceId, status: { in: ["ANUNCIADO", "PADRON_SELLADO"] } },
    orderBy: { drawsAt: "asc" },
    select: { id: true },
  });
  if (abierto) return abierto.id;
  const ultimo = await prisma.raffle.findFirst({
    where: { workspaceId, status: { in: ["SORTEADO", "CERRADO"] } },
    orderBy: { drawsAt: "desc" },
    select: { id: true },
  });
  return ultimo?.id ?? null;
}
