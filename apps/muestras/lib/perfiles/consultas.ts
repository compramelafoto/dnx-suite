import "server-only";
import { prisma } from "@repo/db";

/** El perfil de fotógrafo de una cuenta, o null si todavía no lo creó. */
export function buscarPerfilPropio(userId: number) {
  return prisma.photographerProfile.findUnique({ where: { userId } });
}
