import { puede } from "./policy";

/**
 * Filtro Prisma para listados de entidades con `responsableUserId`.
 * Vacío = ve todo. Sin rol = filtro imposible (-1).
 */
export function filtroSoloAsignado(
  role: string | null | undefined,
  userId: number,
): { responsableUserId: number } | Record<string, never> {
  if (puede(role, "operar")) return {};
  if (puede(role, "verSoloAsignado")) return { responsableUserId: userId };
  return { responsableUserId: -1 };
}
