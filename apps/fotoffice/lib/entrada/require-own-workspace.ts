import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { FOTOFFICE_WORKSPACE_COOKIE } from "@/lib/courses-sales/constants";
import { findFotofficeWorkspaceForUser, type EnsuredWorkspace } from "@/lib/ensure-workspace";
import { WELCOME_PATH } from "./welcome";

/**
 * El workspace del panel de quien está mirando esta pantalla, o afuera.
 *
 * Reemplaza al `ensureFotofficeWorkspaceForUser` que había en siete rutas del panel. Todas
 * hacían lo mismo —"dame el workspace de esta persona"— y ninguna quería crear uno; el
 * problema es que la función que usaban creaba, y por ahí salieron las dos instituciones
 * fantasma de producción.
 *
 * Existe como pieza aparte, y no como siete `if` repetidos, porque el día que ese `if` falte
 * en una sola ruta el defecto vuelve entero. Acá está una vez.
 *
 * Respeta la institución activa (`FOTOFFICE_WORKSPACE_COOKIE`) si la persona es miembro de
 * ella: quien es dueño de su estudio y además está en la Comisión de SFPR, al tocar
 * "Administración" en SFPR, tiene que ver SFPR y no su estudio. Una cookie ajena se ignora
 * (no encuentra membresía) y vale la preferencia de siempre: la propia como dueño.
 * El layout del panel, el onboarding y Configuración la usan todos igual a propósito: si uno
 * mirara la activa y otro la propia, `/workspace` y `/onboarding` podrían rebotar entre sí.
 *
 * Corta con `redirect`, así el llamador no tiene que acordarse de hacerlo: en una página o un
 * layout eso interrumpe el render, y en una server action interrumpe la acción.
 */
export async function requireOwnWorkspace(user: {
  id: number;
  email: string;
  name?: string | null;
}): Promise<EnsuredWorkspace> {
  const preferredWorkspaceId =
    (await cookies()).get(FOTOFFICE_WORKSPACE_COOKIE)?.value?.trim() || null;

  const propio = await findFotofficeWorkspaceForUser({
    userId: user.id,
    email: user.email,
    name: user.name,
    preferredWorkspaceId,
  });
  // Sin workspace no se le fabrica uno: se le pregunta a qué vino.
  if (!propio) redirect(WELCOME_PATH);
  return propio;
}
