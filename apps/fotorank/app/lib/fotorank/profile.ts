import { prisma } from "@repo/db";
import type { AuthUser } from "../auth";

/**
 * Crea o devuelve el FotorankProfile del usuario.
 * Usar al entrar a FotoRank.
 * Usa upsert para evitar race conditions cuando varias peticiones corren en paralelo.
 */
export async function bootstrapFotorankProfile(user: AuthUser) {
  return prisma.fotorankProfile.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      displayName: user.name || undefined,
    },
  });
}
