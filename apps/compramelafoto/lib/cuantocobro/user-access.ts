import { prisma } from "@/lib/prisma";

/** Marca al usuario como usuario de ¿Cuánto Cobro? (solo usuarios autenticados). */
export async function markCuantoCobroUserAccess(userId: number): Promise<void> {
  const now = new Date();
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { cuantoCobroFirstSeenAt: true },
  });

  if (!existing) return;

  await prisma.user.update({
    where: { id: userId },
    data: {
      cuantoCobroUser: true,
      cuantoCobroLastSeenAt: now,
      ...(existing.cuantoCobroFirstSeenAt == null ? { cuantoCobroFirstSeenAt: now } : {}),
    },
  });
}

export function buildCuantoCobroSignupUserFields(now = new Date()) {
  return {
    cuantoCobroUser: true,
    cuantoCobroFirstSeenAt: now,
    cuantoCobroLastSeenAt: now,
  };
}
