import "server-only";
import { prisma } from "@repo/db";
import {
  parsePerfilProfesional,
  type PerfilProfesionalInput,
} from "@/lib/membership/professional-profile";

export type ResultadoPerfil =
  | { ok: true }
  | { ok: false; error: string; field?: string };

/**
 * Guarda el perfil profesional del socio que corresponde a este usuario.
 *
 * Actualiza **una sola** ficha, la misma que muestra el portal (ver `loadPortalContext`).
 * Un `updateMany` por `userId` sería más corto y estaría mal: quien sea socio de dos
 * instituciones tiene dos fichas, y editar el perfil en una pisaría el de la otra sin
 * que nadie se entere.
 *
 * El `userId` va también en el `where` del update, no solo en la búsqueda: la escritura queda
 * atada a quien inició sesión.
 */
export async function guardarPerfilProfesional(
  userId: number,
  entrada: PerfilProfesionalInput
): Promise<ResultadoPerfil> {
  const parsed = parsePerfilProfesional(entrada);
  if (!parsed.ok) return parsed;

  const socio = await prisma.member.findFirst({
    where: { userId, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!socio) return { ok: false, error: "No encontramos tu ficha de socio." };

  const actualizadas = await prisma.member.updateMany({
    where: { id: socio.id, userId },
    data: parsed.data,
  });
  if (actualizadas.count === 0) {
    return { ok: false, error: "No encontramos tu ficha de socio." };
  }
  return { ok: true };
}
