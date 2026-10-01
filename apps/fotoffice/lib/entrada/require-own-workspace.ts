import "server-only";
import { redirect } from "next/navigation";
import { findFotofficeWorkspaceForUser, type EnsuredWorkspace } from "@/lib/ensure-workspace";
import { WELCOME_PATH } from "./welcome";

/**
 * El workspace propio de quien está mirando esta pantalla, o afuera.
 *
 * Reemplaza al `ensureFotofficeWorkspaceForUser` que había en siete rutas del panel. Todas
 * hacían lo mismo —"dame el workspace de esta persona"— y ninguna quería crear uno; el
 * problema es que la función que usaban creaba, y por ahí salieron las dos instituciones
 * fantasma de producción.
 *
 * Existe como pieza aparte, y no como siete `if` repetidos, porque el día que ese `if` falte
 * en una sola ruta el defecto vuelve entero. Acá está una vez.
 *
 * Corta con `redirect`, así el llamador no tiene que acordarse de hacerlo: en una página o un
 * layout eso interrumpe el render, y en una server action interrumpe la acción.
 */
export async function requireOwnWorkspace(user: {
  id: number;
  email: string;
  name?: string | null;
}): Promise<EnsuredWorkspace> {
  const propio = await findFotofficeWorkspaceForUser({
    userId: user.id,
    email: user.email,
    name: user.name,
  });
  // Sin workspace no se le fabrica uno: se le pregunta a qué vino.
  if (!propio) redirect(WELCOME_PATH);
  return propio;
}
