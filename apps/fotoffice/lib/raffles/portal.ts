import "server-only";
import { prisma } from "@repo/db";
import { isEligible } from "./eligibility";
import { loadMemberForRaffle } from "./repository";
import { resolveLogoUrl } from "./logo-url";

/**
 * Lo que el socio ve de los sorteos.
 *
 * ── La regla que ordena este archivo ──
 *
 * Antes de sellar, la situación se **calcula**; después de sellar, se **lee** del padrón
 * congelado. Son dos preguntas distintas: "¿estarías participando hoy?" y "¿participaste?".
 * Contestar la segunda con el cálculo de la primera es lo que haría que un socio que pagó
 * tarde creyera que entró en un sorteo del que quedó afuera — o al revés, que uno que entró
 * y después se atrasó creyera que lo sacaron.
 *
 * Por eso `frozen` viaja hasta la pantalla: no es un detalle técnico, cambia lo que hay que
 * decirle a la persona.
 */

export type PortalPrize = {
  id: string;
  order: number;
  title: string;
  description: string | null;
  partnerName: string | null;
  /** Ya resuelta a una dirección que el navegador del socio puede pedir. */
  partnerLogoUrl: string | null;
  winnerLabel: string | null;
};

export type PortalAward = {
  prizeTitle: string;
  conditions: string | null;
  pickupInstructions: string | null;
  pickupDeadline: Date | null;
  status: string;
};

export type PortalRaffleView = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  entriesCloseAt: Date;
  drawsAt: Date;
  entrantsCount: number | null;
  drandRound: number | null;
  cancelReason: string | null;
  prizes: PortalPrize[];
  myStatus: {
    participating: boolean;
    /** En castellano, listo para mostrar. `null` cuando participa. */
    reason: string | null;
    /** El padrón ya se cerró: esto ya no cambia por más que pague. */
    frozen: boolean;
  };
  myAwards: PortalAward[];
};

type FilaSorteo = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  entriesCloseAt: Date;
  drawsAt: Date;
  entrantsCount: number | null;
  drandRound: number | null;
  cancelReason: string | null;
  prizes: {
    id: string;
    order: number;
    title: string;
    description: string | null;
    conditions: string | null;
    pickupInstructions: string | null;
    pickupDeadline: Date | null;
    partnerNameSnapshot: string | null;
    partnerLogoSnapshot: string | null;
    award: { memberId: string; status: string; winnerPosition: number } | null;
  }[];
  entries: { memberId: string; position: number }[];
};

/** Los estados en los que el padrón ya está congelado. */
const SELLADO = new Set(["PADRON_SELLADO", "SORTEADO", "CERRADO"]);

export async function loadPortalRaffles(input: {
  workspaceId: string;
  memberId: string;
  now?: Date;
}): Promise<{ current: PortalRaffleView | null; past: PortalRaffleView[] }> {
  const [filas, socio] = await Promise.all([
    prisma.raffle.findMany({
      where: { workspaceId: input.workspaceId, status: { not: "BORRADOR" } },
      orderBy: { drawsAt: "desc" },
      take: 24,
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        entriesCloseAt: true,
        drawsAt: true,
        entrantsCount: true,
        drandRound: true,
        cancelReason: true,
        prizes: {
          orderBy: { order: "asc" },
          select: {
            id: true,
            order: true,
            title: true,
            description: true,
            conditions: true,
            pickupInstructions: true,
            pickupDeadline: true,
            partnerNameSnapshot: true,
            partnerLogoSnapshot: true,
            award: { select: { memberId: true, status: true, winnerPosition: true } },
          },
        },
        // Sólo la propia entrada: el padrón completo se publica en la pantalla de
        // verificación, no acá.
        entries: { where: { memberId: input.memberId }, select: { memberId: true, position: true } },
      },
    }),
    loadMemberForRaffle(input.workspaceId, input.memberId),
  ]);

  const vistas = (filas as FilaSorteo[]).map((f) => armarVista(f, socio, input.memberId));

  // El actual es el que todavía no se resolvió y no se canceló. Puede no haber ninguno.
  const current =
    vistas.find((v) => v.status === "ANUNCIADO" || v.status === "PADRON_SELLADO") ?? null;
  const past = vistas.filter((v) => v.status === "SORTEADO" || v.status === "CERRADO");

  return { current, past };
}

function armarVista(
  f: FilaSorteo,
  socio: Awaited<ReturnType<typeof loadMemberForRaffle>>,
  memberId: string,
): PortalRaffleView {
  const congelado = SELLADO.has(f.status);

  const myStatus = congelado
    ? {
        participating: f.entries.length > 0,
        reason:
          f.entries.length > 0
            ? null
            : "El padrón de este sorteo ya estaba cerrado cuando quedaste al día. Vas a poder participar del próximo.",
        frozen: true,
      }
    : socio === null
      ? { participating: false, reason: "No encontramos tu ficha de socio.", frozen: false }
      : (() => {
          // `isEligible` habla de elegibilidad; acá se habla de participación. Se traduce en
          // un solo lugar en vez de exponer dos vocabularios para lo mismo.
          const e = isEligible(socio, f.entriesCloseAt);
          return { participating: e.eligible, reason: e.reason, frozen: false };
        })();

  const partnersBaseUrl = process.env.PARTNERS_PUBLIC_URL ?? null;
  const prizes: PortalPrize[] = f.prizes.map((p) => ({
    id: p.id,
    order: p.order,
    title: p.title,
    description: p.description,
    partnerName: p.partnerNameSnapshot,
    partnerLogoUrl: resolveLogoUrl(p.partnerLogoSnapshot, partnersBaseUrl),
    winnerLabel: p.award ? `Socio en la posición ${p.award.winnerPosition}` : null,
  }));

  const myAwards: PortalAward[] = f.prizes
    .filter((p) => p.award?.memberId === memberId)
    .map((p) => ({
      prizeTitle: p.title,
      conditions: p.conditions,
      pickupInstructions: p.pickupInstructions,
      pickupDeadline: p.pickupDeadline,
      status: p.award?.status ?? "GANADO",
    }));

  return {
    id: f.id,
    title: f.title,
    description: f.description,
    status: f.status,
    entriesCloseAt: f.entriesCloseAt,
    drawsAt: f.drawsAt,
    entrantsCount: f.entrantsCount,
    drandRound: f.drandRound,
    cancelReason: f.cancelReason,
    prizes,
    myStatus,
    myAwards,
  };
}
