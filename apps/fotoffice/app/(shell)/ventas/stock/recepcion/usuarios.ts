import "server-only";
import { prisma } from "@repo/db";
import { etiquetaDeUsuario } from "@/lib/listado/acceso";

/** Cómo se nombra a quien creó o confirmó una recepción (la misma regla que el registro de actividad). */
export async function nombresDeUsuarios(ids: readonly (number | null)[]): Promise<Map<number, string>> {
  const unicos = [...new Set(ids.filter((id): id is number => id !== null))];
  if (unicos.length === 0) return new Map();
  const usuarios = await prisma.user.findMany({
    where: { id: { in: unicos } },
    select: { id: true, name: true, email: true },
  });
  return new Map(usuarios.map((u) => [u.id, etiquetaDeUsuario(u)]));
}
