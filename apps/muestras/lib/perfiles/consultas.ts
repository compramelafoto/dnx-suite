import "server-only";
import { prisma } from "@repo/db";

/** El perfil de fotógrafo de una cuenta, o null si todavía no lo creó. */
export function buscarPerfilPropio(userId: number) {
  return prisma.photographerProfile.findUnique({ where: { userId } });
}

/** Las obras vinculadas a un perfil, con su muestra, para "Mi perfil". */
export function obrasVinculadas(profileId: string) {
  return prisma.culturalActivityWork.findMany({
    where: { authorProfileId: profileId },
    select: { id: true, title: true, imageUrl: true, activity: { select: { title: true, slug: true, reviewStatus: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}
