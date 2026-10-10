import "server-only";
import { prisma } from "@repo/db";
import { dondePuede } from "@/lib/equipo/permisos";
import type { Usuario } from "@/lib/usuario";

/** Lo publicado, lo más nuevo primero. Sólo lo que se muestra: nada de ids de moderador. */
export function entradasPublicadas(activityId: string, take: number) {
  return prisma.culturalActivityGuestbookEntry.findMany({
    where: { activityId, status: "PUBLISHED" },
    select: { id: true, name: true, city: true, comment: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take,
  });
}

/** Para el panel: la muestra (con `guestbook`: dueño, coorganización o super admin) con todos sus comentarios. */
export async function libroParaModerar(id: string, usuario: Pick<Usuario, "id" | "esSuperAdmin">) {
  return prisma.culturalActivity.findFirst({
    where: { id, type: "MUESTRA", ...dondePuede(usuario, "guestbook") },
    select: {
      id: true, slug: true, title: true, type: true, reviewStatus: true, isCancelled: true, guestbookMode: true, endsAt: true,
      guestbookEntries: { orderBy: { createdAt: "desc" }, take: 500, select: { id: true, name: true, city: true, comment: true, status: true, createdAt: true } },
    },
  });
}
