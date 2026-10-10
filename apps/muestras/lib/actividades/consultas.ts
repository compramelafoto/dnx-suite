import "server-only";
import { cache } from "react";
import { prisma } from "@repo/db";
import { activityRole } from "@repo/muestras";
import { dondePuede } from "@/lib/equipo/permisos";
import type { Usuario } from "@/lib/usuario";

type Quien = Pick<Usuario, "id" | "esSuperAdmin">;

/** La fila del equipo de esta persona (para `activityRole`): sólo la suya y activa. */
const miFila = (usuario: Quien) =>
  ({ where: { userId: usuario.id, status: "ACTIVE" }, select: { userId: true, role: true, status: true } }) as const;

const CAMPOS_PUBLICOS = {
  id: true, slug: true, type: true, title: true, coverImageUrl: true, organizersText: true,
  startsAt: true, endsAt: true, scheduleText: true, isVirtualOnly: true, venueName: true,
  city: true, province: true, latitude: true, longitude: true, isCancelled: true,
} as const;

export type ActividadPublica = Awaited<ReturnType<typeof listarPublicas>>[number];

/** Todo lo publicado, incluido el archivo. El filtro por fecha y provincia se hace con `applyFilter`. */
export function listarPublicas() {
  return prisma.culturalActivity.findMany({
    where: { reviewStatus: "APPROVED" },
    select: CAMPOS_PUBLICOS,
    orderBy: { startsAt: "asc" },
    take: 2000,
  });
}

/** Publicada, con sus obras y el perfil de cada autor. `cache`: metadatos y página la piden juntos. */
export const buscarPorSlug = cache((slug: string) =>
  prisma.culturalActivity.findFirst({
    where: { slug, reviewStatus: "APPROVED" },
    include: {
      works: {
        orderBy: { sortOrder: "asc" },
        include: { authorProfile: { select: { slug: true, displayName: true } } },
      },
    },
  }),
);

/** Las que propuso y las que organiza en equipo (etapa 5), cada una con su rol. */
export async function listarMias(usuario: Quien) {
  const filas = await prisma.culturalActivity.findMany({
    where: dondePuede(usuario, "view", { listado: true }),
    select: {
      id: true, slug: true, title: true, type: true, reviewStatus: true, rejectionReason: true, startsAt: true, endsAt: true, isCancelled: true,
      proposedByUserId: true, members: miFila(usuario),
    },
    orderBy: { updatedAt: "desc" },
  });
  return filas.map(({ proposedByUserId, members, ...resto }) => ({ ...resto, rol: activityRole({ proposedByUserId, members }, usuario.id) }));
}

export function listarParaRevisar() {
  return prisma.culturalActivity.findMany({
    where: { reviewStatus: { in: ["IN_REVIEW", "APPROVED", "UNPUBLISHED"] } },
    include: { works: { orderBy: { sortOrder: "asc" }, take: 6 } },
    orderBy: [{ reviewStatus: "asc" }, { submittedAt: "asc" }],
    take: 200,
  });
}

/**
 * Una muestra del panel para quien tiene `view` (dueño, equipo activo o super admin), con el rol
 * de esta persona. Para el super admin que no es del equipo el rol es `null` (igual puede todo).
 */
export async function buscarParaEditar(id: string, usuario: Quien) {
  const a = await prisma.culturalActivity.findFirst({
    where: { id, ...dondePuede(usuario, "view") },
    include: {
      works: { orderBy: { sortOrder: "asc" }, include: { authorProfile: { select: { displayName: true } } } },
      members: miFila(usuario),
    },
  });
  if (!a) return null;
  const { members, ...actividad } = a;
  return { actividad, rol: activityRole({ proposedByUserId: a.proposedByUserId, members }, usuario.id) };
}

export function contarParaRevisar() {
  return prisma.culturalActivity.count({ where: { reviewStatus: "IN_REVIEW" } });
}

/** Las muestras con `hanging` en cualquier estado, para "Montaje e impresión" (el plano se prepara antes de publicar). */
export function listarMuestrasParaMontaje(usuario: Quien) {
  return prisma.culturalActivity.findMany({
    where: { type: "MUESTRA", reviewStatus: { not: "REJECTED" }, ...dondePuede(usuario, "hanging", { listado: true }) },
    select: { id: true, title: true, reviewStatus: true, startsAt: true, endsAt: true, _count: { select: { works: true } } },
    orderBy: { startsAt: "desc" },
  });
}
