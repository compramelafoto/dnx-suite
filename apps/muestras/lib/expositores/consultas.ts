import "server-only";
import { prisma } from "@repo/db";
import { exhibitorLinkState, temporalStatus } from "@repo/muestras";
import { esTokenConForma } from "@/lib/curaduria/token";
import { conPermiso } from "@/lib/equipo/permisos";
import { baseUrlPublica } from "@/lib/fichas/cargar";
import type { Usuario } from "@/lib/usuario";

type Quien = Pick<Usuario, "id" | "esSuperAdmin">;

/**
 * El enlace de expositores de una muestra para quien tiene `exhibitors` (dueño, coorganización o
 * super admin). `null` si no existe o no puede: la página responde 404.
 */
export async function enlaceDeExpositores(activityId: string, usuario: Quien) {
  const a = await prisma.culturalActivity.findFirst({
    where: conPermiso({ id: activityId, type: "MUESTRA" }, usuario, "exhibitors"),
    select: {
      id: true, slug: true, title: true, type: true, reviewStatus: true, isCancelled: true, startsAt: true, endsAt: true,
      galleryMode: true, visibility: true,
      exhibitorLink: {
        select: { token: true, status: true, closesAt: true, maxWorksPerExhibitor: true, maxExhibitors: true, instructions: true, rotatedAt: true },
      },
      _count: { select: { exhibitors: { where: { status: "ACTIVE" } } } },
    },
  });
  if (!a) return null;
  const { exhibitorLink: enlace, _count, visibility, ...muestra } = a;
  const ahora = new Date();
  return {
    cerrada: temporalStatus(a, ahora) === "CLOSED",
    muestra,
    tieneAjuste: visibility != null,
    enlace,
    estado: exhibitorLinkState(enlace, a, ahora),
    url: enlace ? `${baseUrlPublica()}/expositores/${enlace.token}` : null,
    expositores: _count.exhibitors,
  };
}

/**
 * El enlace de expositores por su token, para la página pública `/expositores/<token>` (spec D3).
 * `null` si el token no tiene forma (ni se consulta la base) o no existe. Nunca devuelve el token:
 * lo que sale de acá puede llegar a componentes cliente.
 */
export async function enlacePorToken(token: string) {
  if (!esTokenConForma(token)) return null;
  const e = await prisma.culturalExhibitorLink.findUnique({
    where: { token },
    select: {
      status: true, closesAt: true, maxWorksPerExhibitor: true, maxExhibitors: true, instructions: true,
      activity: {
        select: {
          id: true, slug: true, title: true, type: true, reviewStatus: true, isCancelled: true, startsAt: true, endsAt: true,
          coverImageUrl: true, organizersText: true, venueName: true, city: true, province: true, isVirtualOnly: true,
          _count: { select: { exhibitors: { where: { status: "ACTIVE" } } } },
        },
      },
    },
  });
  if (!e) return null;
  const { activity: { _count, ...muestra }, ...enlace } = e;
  return { enlace, muestra, estado: exhibitorLinkState(e, e.activity, new Date()), expositores: _count.exhibitors };
}

/** La participación propia en una muestra (cualquier estado), o `null`. Siempre por la cuenta. */
export async function miFilaEnMuestra(activityId: string, userId: number) {
  return prisma.culturalExhibitor.findUnique({
    where: { activityId_userId: { activityId, userId } },
    select: { id: true, status: true },
  });
}

/** "Donde expongo": las muestras donde esta persona se sumó, con el estado de sus obras. */
export async function misParticipaciones(usuario: Quien) {
  return prisma.culturalExhibitor.findMany({
    where: { userId: usuario.id },
    select: {
      id: true, status: true, displayName: true, joinedAt: true,
      activity: { select: { id: true, slug: true, title: true, startsAt: true, endsAt: true, isCancelled: true } },
      works: { select: { status: true } },
    },
    orderBy: { joinedAt: "desc" },
    take: 200,
  });
}

/**
 * Una participación propia con sus obras, para `/panel/expositor/<id>`. Siempre filtrada por la
 * cuenta: la de otra persona "no existe" (spec D11). Sólo trae lo propio, precio incluido.
 */
export async function miParticipacion(id: string, usuario: Quien) {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return null;
  const e = await prisma.culturalExhibitor.findFirst({
    where: { id, userId: usuario.id },
    select: {
      id: true, status: true, displayName: true,
      profile: { select: { slug: true, bio: true } },
      activity: {
        select: {
          id: true, slug: true, title: true, type: true, reviewStatus: true, isCancelled: true, startsAt: true, endsAt: true,
          organizersText: true,
          exhibitorLink: { select: { status: true, closesAt: true, maxWorksPerExhibitor: true, instructions: true } },
        },
      },
      works: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true, status: true, imageUrl: true, title: true, year: true, technique: true, imageWidthCm: true, imageHeightCm: true,
          frameWidthCm: true, frameHeightCm: true, edition: true, editionNumber: true, editionSize: true, statement: true,
          forSale: true, priceArs: true, hangingNotes: true, reviewNote: true, activityWorkId: true,
        },
      },
    },
  });
  if (!e) return null;
  return { ...e, estadoEnlace: exhibitorLinkState(e.activity.exhibitorLink, e.activity, new Date()) };
}
