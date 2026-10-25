import "server-only";
import { prisma } from "@repo/db";
import type { Usuario } from "@/lib/usuario";

/** El portfolio de la propia cuenta, para "Mi perfil de fotógrafo". `null` si todavía no tiene perfil. */
export async function portfolioPropio(usuario: Pick<Usuario, "id">) {
  const perfil = await prisma.photographerProfile.findUnique({ where: { userId: usuario.id }, select: { id: true } });
  if (!perfil) return null;
  return prisma.photographerPortfolioPhoto.findMany({
    where: { profileId: perfil.id },
    orderBy: { sortOrder: "asc" },
    select: { id: true, imageUrl: true, title: true, year: true, technique: true, caption: true },
  });
}
