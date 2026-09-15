import { PORTAL_HOME } from "../portal/destination";
import type { UserProfile } from "../portal/profiles";

/**
 * La puerta propia de cada institución.
 *
 * `fotoffice.com/w/sfpr/entrar` es el inicio de sesión de SFPR: mismo formulario de siempre,
 * pero con el nombre y el logo de la institución, y con una consecuencia real. Entrar por ahí
 * es decir "vengo a SFPR" antes de escribir la contraseña, y eso alcanza para no tener que
 * preguntarle nada a quien tiene más de un perfil.
 *
 * Se apoya en el `next` que el panel de login ya sabe llevar —va como campo oculto en el
 * formulario y pegado al botón de Google—, así que no hizo falta plomería nueva ni tocar el
 * paquete de autenticación compartido con las otras aplicaciones.
 */

/** La dirección de la puerta de una institución. */
export function doorPathFor(slug: string): string {
  return `/w/${slug}/entrar`;
}

/**
 * El slug de la institución si este `next` es una puerta, o `null`.
 *
 * Estricto a propósito: `next` lo escribe el navegador. Solo pasa la forma exacta
 * `/w/<slug>/entrar`, con el slug limitado al alfabeto de los slugs — nada de barras, puntos,
 * parámetros ni host. Todo lo demás es `null` y sigue el camino de siempre.
 */
export function parseDoorPath(next: string | null | undefined): string | null {
  if (typeof next !== "string") return null;
  const match = /^\/w\/([a-z0-9][a-z0-9-]*)\/entrar$/.exec(next.trim());
  return match?.[1] ?? null;
}

export type DoorDestination =
  | { redirectTo: string }
  /** No es nada de esta institución. La puerta se aparta y decide el camino normal. */
  | { unknownHere: true };

/**
 * A dónde va quien entró por la puerta de una institución.
 *
 * Nunca deja a nadie afuera: si la persona no tiene nada que ver con esa institución,
 * devuelve `unknownHere` y quien llama sigue con la resolución habitual. La puerta es una
 * comodidad —te ahorra elegir—, no un control de acceso. Los controles siguen estando donde
 * estaban: cada ruta autoriza por su cuenta.
 */
export function resolveDoorDestination(input: {
  workspaceId: string;
  profiles: UserProfile[];
}): DoorDestination {
  const aca = input.profiles.filter((p) => p.workspaceId === input.workspaceId);
  if (aca.length === 0) return { unknownHere: true };

  // Ser equipo gana, igual que en `resolveFotofficeUserKind`: quien administra la institución
  // y además es socio entra a administrar, y desde ahí puede cambiar de perfil.
  const esEquipo = aca.some((p) => p.kind === "TEAM");
  return { redirectTo: esEquipo ? "/workspace" : PORTAL_HOME };
}
