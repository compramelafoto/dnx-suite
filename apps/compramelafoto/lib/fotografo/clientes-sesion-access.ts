import { Role } from "@prisma/client";

/** Roles que pueden ver y editar sus clientes desde el panel del fotógrafo. */
export const FOTOGRAFO_CLIENTES_ROLES: Role[] = [Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER];

export type FotografoSessionDecision =
  | { ok: true; photographerId: number }
  | { ok: false; status: 401 | 403; error: string };

/**
 * Traduce el resultado de `requireAuth` en la decisión para las rutas de clientes.
 * El fotógrafo SIEMPRE es la persona en sesión (`user.id`): el `photographerId`
 * que mande el navegador (query o cuerpo) se ignora.
 */
export function decideFotografoClientesAccess(auth: {
  error: string | null;
  user: { id: number } | null;
}): FotografoSessionDecision {
  if (!auth.user) {
    if (auth.error === "No autorizado") {
      return { ok: false, status: 403, error: "No autorizado" };
    }
    return { ok: false, status: 401, error: "No autenticado" };
  }
  return { ok: true, photographerId: auth.user.id };
}
