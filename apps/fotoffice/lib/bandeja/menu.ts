import "server-only";
import { prisma } from "@repo/db";

/**
 * Total de mensajes sin leer para el menú. Lo llama el marco del panel DESPUÉS de comprobar que la
 * persona tiene "Ver" en el módulo (el nivel sale de `getModuleLevels`, que ya mira el workspace).
 * Si la lectura falla (por ejemplo, tabla sin migrar) devuelve 0: el menú nunca rompe una pantalla.
 */
export async function noLeidosParaElMenu(workspaceId: string): Promise<number> {
  try {
    const filas = await prisma.fotofficeWaChat.findMany({
      where: { workspaceId, noLeidos: { gt: 0 } },
      select: { noLeidos: true },
      take: 5000,
    });
    return filas.reduce((suma, f) => suma + f.noLeidos, 0);
  } catch {
    return 0;
  }
}
