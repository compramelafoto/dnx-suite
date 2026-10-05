import "server-only";
import { randomInt } from "node:crypto";
import { prisma, type Prisma } from "@repo/db";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { COMMUNICATIONS_MODULE_KEY } from "@/lib/communications/constants";
import { PORTFOLIO_MODULE_KEY } from "@/lib/portfolio/constants";
import { portfolioVisibility } from "@/lib/portfolio/visibility";
import { portfolioPath } from "@/lib/portfolio/public-seo";
import { pickSpotlight } from "./pick";
import { spotlightWeekStart } from "./week";
import type { AboutMe } from "./about";

/**
 * El Socio de la semana en la base: elegirlo, leerlo, saltearlo y marcar su placa.
 *
 * La rotación vive dentro del módulo Comunicación: con el módulo apagado no se elige a nadie.
 */

export async function isSpotlightEnabled(workspaceId: string): Promise<boolean> {
  return isModuleEnabledForWorkspace(workspaceId, COMMUNICATIONS_MODULE_KEY);
}

/** Un número criptográfico en [0, 1): el sorteo no tiene que poder adivinarse. */
function azar(): number {
  return randomInt(0, 2 ** 32) / 2 ** 32;
}

/**
 * Candado por institución, dentro de la transacción.
 *
 * La elección corre desde dos lugares —la tarea de los viernes y la primera visita al panel, por
 * si la tarea no corrió— y los dos pueden llegar a la vez. Sin candado, cada uno vería la semana
 * vacía y elegiría a alguien distinto. Se libera solo al terminar la transacción.
 */
async function bloquear(tx: Prisma.TransactionClient, workspaceId: string) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`spotlight:${workspaceId}`}))::text`;
}

/** Elige al socio de la semana de `weekStart` si todavía no hay uno. Dentro de una transacción. */
async function elegirSiFalta(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  weekStart: Date,
): Promise<{ id: string; memberId: string } | null> {
  const vigente = await tx.memberSpotlight.findFirst({
    where: { workspaceId, weekStart, skippedAt: null },
    select: { id: true, memberId: true },
  });
  if (vigente) return vigente;

  const [activos, historia] = await Promise.all([
    tx.member.findMany({ where: { workspaceId, status: "ACTIVE" }, select: { id: true } }),
    tx.memberSpotlight.findMany({
      where: { workspaceId },
      select: { memberId: true, round: true, weekStart: true, skippedAt: true },
    }),
  ]);

  const elegido = pickSpotlight({
    candidates: activos.map((m) => m.id),
    history: historia.map((h) => ({
      memberId: h.memberId,
      round: h.round,
      weekStart: h.weekStart,
      skipped: h.skippedAt !== null,
    })),
    // Los salteados de esta misma semana no vuelven a salir en ella, ni aunque empiece otra vuelta.
    exclude: historia
      .filter((h) => h.skippedAt !== null && h.weekStart.getTime() === weekStart.getTime())
      .map((h) => h.memberId),
    random: azar,
  });
  if (!elegido) return null;

  return tx.memberSpotlight.create({
    data: { workspaceId, memberId: elegido.memberId, weekStart, round: elegido.round },
    select: { id: true, memberId: true },
  });
}

/**
 * Se asegura de que la semana actual tenga su socio. Idempotente: si ya hay uno, no hace nada.
 *
 * La llaman la tarea de los viernes y, como red, el panel del socio y el de Comunicación: si un
 * viernes la tarea no corrió, la primera visita elige. Nunca queda una semana vacía.
 */
export async function ensureCurrentSpotlight(
  workspaceId: string,
  now = new Date(),
): Promise<{ id: string; memberId: string } | null> {
  if (!(await isSpotlightEnabled(workspaceId))) return null;
  const weekStart = spotlightWeekStart(now);
  return prisma.$transaction(async (tx) => {
    await bloquear(tx, workspaceId);
    return elegirSiFalta(tx, workspaceId, weekStart);
  });
}

/** Lo mismo, sin romper la pantalla que lo llama: la tarjeta es un agregado, no el panel. */
export async function ensureCurrentSpotlightSafe(workspaceId: string, now = new Date()) {
  try {
    return await ensureCurrentSpotlight(workspaceId, now);
  } catch (error) {
    console.error("[fotoffice][socio-de-la-semana] no se pudo elegir", {
      workspaceId,
      detalle: error instanceof Error ? error.message : "error desconocido",
    });
    return null;
  }
}

const SELECT_SOCIO = {
  id: true,
  firstName: true,
  lastName: true,
  memberNumber: true,
  status: true,
  joinedAt: true,
  phone: true,
  avatarUrl: true,
  profilePhotoUrl: true,
  city: true,
  province: true,
  studioCity: true,
  studioProvince: true,
  specialties: true,
  businessName: true,
  website: true,
  instagram: true,
  tiktok: true,
  facebook: true,
  youtube: true,
  linkedin: true,
  directoryOptIn: true,
  userId: true,
} as const satisfies Prisma.MemberSelect;

export type SpotlightMember = Prisma.MemberGetPayload<{ select: typeof SELECT_SOCIO }>;

export type SpotlightDetail = {
  id: string;
  weekStart: Date;
  round: number;
  publishedAt: Date | null;
  publishedByName: string | null;
  member: SpotlightMember;
  about: AboutMe | null;
  /** Ruta de su portfolio público, sólo si está al aire. */
  portfolioPath: string | null;
};

function aboutDesdeFila(fila: Prisma.MemberAboutMeGetPayload<object> | null): AboutMe | null {
  if (!fila) return null;
  return {
    howStarted: fila.howStarted,
    passion: fila.passion,
    inspiration: fila.inspiration,
    gear: fila.gear,
    proudPhotoText: fila.proudPhotoText,
    proudPhotoUrl: fila.proudPhotoUrl,
    canHelpWith: fila.canHelpWith,
    wantsToLearn: fila.wantsToLearn,
    beyondPhotography: fila.beyondPhotography,
    whatsappOptIn: fila.whatsappOptIn,
    spotlightNoticeAt: fila.spotlightNoticeAt,
    featuredPhotoUrls: fila.featuredPhotoUrls,
  };
}

export async function loadAboutMe(memberId: string): Promise<AboutMe | null> {
  const fila = await prisma.memberAboutMe.findUnique({ where: { memberId } });
  return aboutDesdeFila(fila);
}

/**
 * La ruta del portfolio público del socio, si está al aire. Mismas reglas que el directorio
 * (`portfolioVisibility`): la tarjeta no puede linkear a una página que da 404.
 */
async function rutaDePortfolio(workspaceId: string, member: SpotlightMember): Promise<string | null> {
  if (!(await isModuleEnabledForWorkspace(workspaceId, PORTFOLIO_MODULE_KEY))) return null;
  const [portfolio, branding, vencidos] = await Promise.all([
    prisma.fotofficeMemberPortfolio.findUnique({
      where: { memberId: member.id },
      select: {
        publicSlug: true,
        memberPublished: true,
        hiddenByAdminAt: true,
        adminForcePublish: true,
        _count: { select: { photos: true } },
      },
    }),
    prisma.fotofficeWorkspaceBranding.findUnique({
      where: { workspaceId },
      select: { publicSlug: true },
    }),
    prisma.membershipCharge.count({
      where: { memberId: member.id, balanceArs: { gt: 0 }, dueDate: { lt: new Date() } },
    }),
  ]);
  if (!portfolio || !branding?.publicSlug) return null;
  const visible = portfolioVisibility({
    moduleEnabled: true,
    hiddenByAdminAt: portfolio.hiddenByAdminAt,
    memberStatus: member.status as "ACTIVE" | "SUSPENDED" | "INACTIVE",
    directoryOptIn: member.directoryOptIn,
    photoCount: portfolio._count.photos,
    memberPublished: portfolio.memberPublished,
    overdueCount: vencidos,
    adminForcePublish: portfolio.adminForcePublish,
  }).visible;
  return visible ? portfolioPath(branding.publicSlug, portfolio.publicSlug) : null;
}

async function nombresDeUsuarios(ids: (number | null)[]): Promise<Map<number, string>> {
  const unicos = [...new Set(ids.filter((v): v is number => v != null))];
  if (unicos.length === 0) return new Map();
  const usuarios = await prisma.user.findMany({
    where: { id: { in: unicos } },
    select: { id: true, name: true, email: true },
  });
  return new Map(usuarios.map((u) => [u.id, u.name?.trim() || u.email]));
}

async function detalle(
  workspaceId: string,
  fila: {
    id: string;
    weekStart: Date;
    round: number;
    publishedAt: Date | null;
    publishedByUserId: number | null;
    member: SpotlightMember;
  },
): Promise<SpotlightDetail> {
  const [about, ruta, nombres] = await Promise.all([
    loadAboutMe(fila.member.id),
    rutaDePortfolio(workspaceId, fila.member),
    nombresDeUsuarios([fila.publishedByUserId]),
  ]);
  return {
    id: fila.id,
    weekStart: fila.weekStart,
    round: fila.round,
    publishedAt: fila.publishedAt,
    publishedByName: fila.publishedByUserId ? (nombres.get(fila.publishedByUserId) ?? null) : null,
    member: fila.member,
    about,
    portfolioPath: ruta,
  };
}

/**
 * El socio de esta semana, con todo lo que muestra la tarjeta.
 *
 * `null` si no hay, o si se dio de baja durante su semana: deja de mostrarse (diseño §Rotación).
 */
export async function loadCurrentSpotlight(
  workspaceId: string,
  now = new Date(),
): Promise<SpotlightDetail | null> {
  const weekStart = spotlightWeekStart(now);
  const fila = await prisma.memberSpotlight.findFirst({
    where: { workspaceId, weekStart, skippedAt: null },
    select: {
      id: true,
      weekStart: true,
      round: true,
      publishedAt: true,
      publishedByUserId: true,
      member: { select: SELECT_SOCIO },
    },
  });
  if (!fila || fila.member.status !== "ACTIVE") return null;
  return detalle(workspaceId, fila);
}

export type SpotlightHistoryItem = {
  id: string;
  weekStart: Date;
  round: number;
  memberId: string;
  memberName: string;
  memberStatus: string;
  skippedAt: Date | null;
  skipReason: string | null;
  skippedByName: string | null;
  publishedAt: Date | null;
  publishedByName: string | null;
};

/** El historial para Comunicación, del más nuevo al más viejo. Incluye los salteos. */
export async function listSpotlightHistory(workspaceId: string, take = 60): Promise<SpotlightHistoryItem[]> {
  const filas = await prisma.memberSpotlight.findMany({
    where: { workspaceId },
    orderBy: [{ weekStart: "desc" }, { createdAt: "desc" }],
    take,
    select: {
      id: true,
      weekStart: true,
      round: true,
      memberId: true,
      skippedAt: true,
      skipReason: true,
      skippedByUserId: true,
      publishedAt: true,
      publishedByUserId: true,
      member: { select: { firstName: true, lastName: true, status: true } },
    },
  });
  const nombres = await nombresDeUsuarios(filas.flatMap((f) => [f.skippedByUserId, f.publishedByUserId]));
  return filas.map((f) => ({
    id: f.id,
    weekStart: f.weekStart,
    round: f.round,
    memberId: f.memberId,
    memberName: `${f.member.firstName} ${f.member.lastName}`.trim(),
    memberStatus: f.member.status,
    skippedAt: f.skippedAt,
    skipReason: f.skipReason,
    skippedByName: f.skippedByUserId ? (nombres.get(f.skippedByUserId) ?? null) : null,
    publishedAt: f.publishedAt,
    publishedByName: f.publishedByUserId ? (nombres.get(f.publishedByUserId) ?? null) : null,
  }));
}

/** Cuántos socios activos faltan pasar en la vuelta en curso: para mostrarle a Comunicación. */
export async function roundProgress(workspaceId: string): Promise<{ round: number; done: number; total: number }> {
  const [activos, historia] = await Promise.all([
    prisma.member.findMany({ where: { workspaceId, status: "ACTIVE" }, select: { id: true } }),
    prisma.memberSpotlight.findMany({ where: { workspaceId }, select: { memberId: true, round: true } }),
  ]);
  const round = historia.reduce((max, h) => Math.max(max, h.round), 1);
  const ids = new Set(activos.map((m) => m.id));
  const pasaron = new Set(historia.filter((h) => h.round === round && ids.has(h.memberId)).map((h) => h.memberId));
  return { round, done: pasaron.size, total: ids.size };
}

/**
 * Saltea al socio de la semana y elige otro en el momento.
 *
 * Sólo la semana en curso: saltear una semana pasada no cambia nada que alguien vea. El salteado
 * cuenta como que ya pasó en la vuelta (no vuelve a salir la semana siguiente).
 */
export async function skipCurrentSpotlight(input: {
  workspaceId: string;
  spotlightId: string;
  userId: number;
  reason: string | null;
  now?: Date;
}): Promise<{ ok: true; replacementMemberId: string | null } | { ok: false; error: string }> {
  const weekStart = spotlightWeekStart(input.now ?? new Date());
  return prisma.$transaction(async (tx) => {
    await bloquear(tx, input.workspaceId);
    const fila = await tx.memberSpotlight.findFirst({
      where: { id: input.spotlightId, workspaceId: input.workspaceId, skippedAt: null },
      select: { id: true, weekStart: true },
    });
    if (!fila) return { ok: false as const, error: "Ese socio ya no es el de la semana." };
    if (fila.weekStart.getTime() !== weekStart.getTime()) {
      return { ok: false as const, error: "Sólo se puede saltear al socio de esta semana." };
    }
    await tx.memberSpotlight.update({
      where: { id: fila.id },
      data: {
        skippedAt: new Date(),
        skippedByUserId: input.userId,
        skipReason: input.reason?.trim().slice(0, 200) || null,
      },
    });
    const nuevo = await elegirSiFalta(tx, input.workspaceId, weekStart);
    return { ok: true as const, replacementMemberId: nuevo?.memberId ?? null };
  });
}

export async function setSpotlightPublished(input: {
  workspaceId: string;
  spotlightId: string;
  userId: number;
  published: boolean;
}): Promise<boolean> {
  const r = await prisma.memberSpotlight.updateMany({
    where: { id: input.spotlightId, workspaceId: input.workspaceId },
    data: input.published
      ? { publishedAt: new Date(), publishedByUserId: input.userId }
      : { publishedAt: null, publishedByUserId: null },
  });
  return r.count > 0;
}
