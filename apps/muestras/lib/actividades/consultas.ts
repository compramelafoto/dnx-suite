import "server-only";
import { prisma } from "@repo/db";
import type { Usuario } from "@/lib/usuario";

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

export function buscarPorSlug(slug: string) {
  return prisma.culturalActivity.findFirst({
    where: { slug, reviewStatus: "APPROVED" },
    include: { works: { orderBy: { sortOrder: "asc" } } },
  });
}

export function listarMias(userId: number) {
  return prisma.culturalActivity.findMany({
    where: { proposedByUserId: userId },
    select: { id: true, slug: true, title: true, type: true, reviewStatus: true, rejectionReason: true, startsAt: true, endsAt: true, isCancelled: true },
    orderBy: { updatedAt: "desc" },
  });
}

export function listarParaRevisar() {
  return prisma.culturalActivity.findMany({
    where: { reviewStatus: { in: ["IN_REVIEW", "APPROVED", "UNPUBLISHED"] } },
    include: { works: { orderBy: { sortOrder: "asc" }, take: 6 } },
    orderBy: [{ reviewStatus: "asc" }, { submittedAt: "asc" }],
    take: 200,
  });
}

/** Una ficha para editar: de quien la propuso, o cualquiera si es super admin. */
export function buscarPropia(id: string, usuario: Usuario) {
  return prisma.culturalActivity.findFirst({
    where: usuario.esSuperAdmin ? { id } : { id, proposedByUserId: usuario.id },
    include: { works: { orderBy: { sortOrder: "asc" } } },
  });
}
