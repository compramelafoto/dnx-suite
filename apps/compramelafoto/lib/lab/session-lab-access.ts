import { Role } from "@prisma/client";

/** Roles que pueden usar las rutas del panel de laboratorio (clientes, etc.). */
export const LAB_SESSION_ROLES: Role[] = [Role.LAB, Role.LAB_PHOTOGRAPHER];

export type LabSessionDecision =
  | { ok: true; labId: number }
  | { ok: false; status: 401 | 403 | 404; error: string };

/**
 * Decide si la persona en sesión puede operar sobre los datos de un laboratorio.
 * El laboratorio SIEMPRE es el de la sesión (`Lab.userId`): nunca se acepta un
 * `labId` que mande el navegador.
 */
export function decideLabSessionAccess(
  user: { id: number; role: Role | string } | null,
  sessionLab: { id: number } | null,
): LabSessionDecision {
  if (!user) return { ok: false, status: 401, error: "No autenticado" };
  if (!LAB_SESSION_ROLES.includes(user.role as Role)) {
    return { ok: false, status: 403, error: "No autorizado" };
  }
  if (!sessionLab) {
    return { ok: false, status: 404, error: "Laboratorio no encontrado" };
  }
  return { ok: true, labId: sessionLab.id };
}

/**
 * Fotógrafo efectivo cuando se cambia el estado de un pedido "como fotógrafo".
 * Siempre es la persona en sesión; el `photographerId` del cuerpo se ignora.
 */
export function effectivePhotographerIdForStatusChange(user: { id: number }): number {
  return user.id;
}
