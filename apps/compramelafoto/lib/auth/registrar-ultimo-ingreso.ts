import { prisma } from "@/lib/prisma";

/**
 * Marca `lastLoginAt = ahora` sin frenar el login (igual que el login con contraseña):
 * si la escritura falla, sólo se avisa en el log.
 */
export function registrarUltimoIngreso(userId: number, origen: string): void {
  void prisma.user
    .update({ where: { id: userId }, data: { lastLoginAt: new Date() } })
    .catch((e: unknown) => console.warn(`${origen}: error actualizando lastLoginAt`, e));
}
