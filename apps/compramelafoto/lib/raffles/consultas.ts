import "server-only";
import { prisma } from "@/lib/prisma";
import { buildVerification, recheck } from "./verification";
import { computeEntrants, loadSalesForUser, loadSettings } from "./repository";
import { orderEntrants } from "./padron";
import { parsePrizeTemplates, parseSponsors, sponsorLogos } from "./mensajes";

/** Lecturas para las pantallas: admin, página pública y panel del fotógrafo. */

export async function listRafflesForAdmin() {
  const rows = await prisma.clfRaffle.findMany({
    orderBy: [{ drawsAt: "desc" }],
    take: 100,
    select: {
      id: true,
      title: true,
      kind: true,
      period: true,
      status: true,
      salesFrom: true,
      salesTo: true,
      minSales: true,
      entriesCloseAt: true,
      drawsAt: true,
      entrantsCount: true,
      coverImageUrl: true,
      prizes: { orderBy: { order: "asc" }, take: 4, select: { imageUrl: true, title: true } },
      _count: { select: { prizes: true, awards: true } },
    },
  });
  return rows;
}

export async function getRaffleForAdmin(id: string) {
  const r = await prisma.clfRaffle.findUnique({
    where: { id },
    include: {
      prizes: { orderBy: { order: "asc" }, include: { award: true } },
      events: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });
  if (!r) return null;

  // Los ganadores con su contacto, para coordinar la entrega.
  const ganadores = r.prizes.flatMap((p) => (p.award ? [p.award.userId] : []));
  const usuarios = ganadores.length
    ? await prisma.user.findMany({
        where: { id: { in: ganadores } },
        select: { id: true, name: true, email: true, phone: true, whatsapp: true, companyName: true },
      })
    : [];
  const porId = new Map(usuarios.map((u) => [u.id, u]));

  // Antes de cerrar el padrón: quiénes entrarían si cerrara ahora. Después: el padrón congelado.
  let padron: { position: number; userId: number; code: string; displayName: string; salesCount: number }[];
  let padronEnVivo = false;
  if (r.entrantsHash) {
    const entries = await prisma.clfRaffleEntry.findMany({
      where: { raffleId: id },
      orderBy: { position: "asc" },
    });
    padron = entries.map((e) => ({
      position: e.position,
      userId: e.userId,
      code: e.codeSnapshot,
      displayName: e.displayNameSnapshot,
      salesCount: e.salesCountSnapshot,
    }));
  } else if (r.status === "CANCELADO") {
    padron = [];
  } else {
    const ajustes = await loadSettings();
    padronEnVivo = true;
    padron = orderEntrants(
      await computeEntrants({
        salesFrom: r.salesFrom,
        salesTo: r.salesTo,
        minSales: r.minSales,
        excludedUserIds: ajustes.excludedUserIds,
      }),
    ).map((e) => ({ ...e }));
  }

  const verificacion = buildVerification({
    ...r,
    entries: padron.map((e) => ({
      position: e.position,
      codeSnapshot: e.code,
      displayNameSnapshot: e.displayName,
    })),
  });

  return {
    raffle: {
      ...r,
      sponsors: parseSponsors(r.sponsors),
      prizes: r.prizes.map((p) => ({
        ...p,
        winner: p.award ? porId.get(p.award.userId) ?? null : null,
        winnerEntry: p.award ? padron.find((e) => e.position === p.award!.winnerPosition) ?? null : null,
      })),
    },
    padron,
    padronEnVivo,
    verificacion: verificacion ? recheck(verificacion) : null,
  };
}

export async function getSettingsForAdmin() {
  const s = await loadSettings();
  return { ...s, monthlyPrizes: parsePrizeTemplates(s.monthlyPrizes), monthlySponsors: parseSponsors(s.monthlySponsors) };
}

/** La página pública de verificación: sin correos ni datos de contacto. */
export async function getPublicRaffle(id: string) {
  const r = await prisma.clfRaffle.findUnique({
    where: { id },
    include: {
      prizes: { orderBy: { order: "asc" }, include: { award: { select: { winnerPosition: true, status: true } } } },
      entries: { orderBy: { position: "asc" }, select: { position: true, codeSnapshot: true, displayNameSnapshot: true } },
    },
  });
  if (!r || r.status === "BORRADOR" || r.status === "CANCELADO") return null;
  const data = buildVerification({
    ...r,
    prizes: r.prizes.map((p) => ({
      order: p.order,
      title: p.title,
      award: p.award && p.award.status !== "ANULADO" ? { winnerPosition: p.award.winnerPosition } : null,
    })),
  });
  return {
    raffle: r,
    logos: sponsorLogos(parseSponsors(r.sponsors), r.prizes),
    verification: data,
    check: data ? recheck(data) : null,
  };
}

/**
 * Lo que ve el fotógrafo en su panel: los sorteos abiertos y los recién sorteados, si entra o
 * cuántas ventas le faltan, y si ganó algo.
 */
export async function getRafflesForPhotographer(userId: number, now = new Date()) {
  const hace30 = new Date(now.getTime() - 30 * 86_400_000);
  const sorteos = await prisma.clfRaffle.findMany({
    where: {
      OR: [
        { status: { in: ["ANUNCIADO", "PADRON_SELLADO"] } },
        { status: { in: ["SORTEADO", "CERRADO"] }, drawnAt: { gte: hace30 } },
      ],
    },
    orderBy: { drawsAt: "asc" },
    take: 5,
    include: {
      prizes: {
        orderBy: { order: "asc" },
        select: {
          title: true,
          sponsorName: true,
          imageUrl: true,
          sponsorLogoUrl: true,
          sponsorUrl: true,
          award: { select: { userId: true, status: true } },
        },
      },
    },
  });
  if (sorteos.length === 0) return [];

  const ajustes = await loadSettings();
  const excluido = ajustes.excludedUserIds.includes(userId);

  return Promise.all(
    sorteos.map(async (s) => {
      let misVentas: number | null = null;
      let participa: boolean | null = null;
      if (s.status === "ANUNCIADO") {
        misVentas = await loadSalesForUser(userId, s.salesFrom, s.salesTo);
        participa = !excluido && misVentas >= s.minSales;
      } else {
        const entry = await prisma.clfRaffleEntry.findUnique({
          where: { raffleId_userId: { raffleId: s.id, userId } },
          select: { salesCountSnapshot: true },
        });
        participa = Boolean(entry);
        misVentas = entry?.salesCountSnapshot ?? null;
      }
      const gane = s.prizes
        .filter((p) => p.award?.userId === userId && p.award.status !== "ANULADO")
        .map((p) => p.title);
      return {
        id: s.id,
        title: s.title,
        status: s.status,
        salesFrom: s.salesFrom.toISOString(),
        salesTo: s.salesTo.toISOString(),
        drawsAt: s.drawsAt.toISOString(),
        minSales: s.minSales,
        entrantsCount: s.entrantsCount,
        coverImageUrl: s.coverImageUrl,
        logos: sponsorLogos(parseSponsors(s.sponsors), s.prizes),
        prizes: s.prizes.map((p) => ({ title: p.title, sponsorName: p.sponsorName, imageUrl: p.imageUrl })),
        misVentas,
        participa,
        gane,
      };
    }),
  );
}
