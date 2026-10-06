import { PORTAL_HOME } from "../portal/destination";
import { resolveEntryProfile, type UserProfile } from "../portal/profiles";

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

/**
 * La dirección de la puerta de una institución.
 *
 * Con `reserva`, la puerta además recuerda qué espacio y qué semana estaba mirando la persona:
 * así quien toca "Ingresar" desde la página de reservas vuelve a esa misma reserva, ya
 * reconocida como socia, en vez de aterrizar en el inicio del portal.
 */
export function doorPathFor(slug: string, reserva?: { spaceId: string; ymd?: string }): string {
  const base = `/w/${slug}/entrar`;
  if (!reserva || !ID_RESERVA.test(reserva.spaceId)) return base;
  const fecha = reserva.ymd && FECHA.test(reserva.ymd) ? `&fecha=${reserva.ymd}` : "";
  return `${base}?espacio=${reserva.spaceId}${fecha}`;
}

const ID_RESERVA = /^[a-z0-9]{1,40}$/;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const PUERTA = /^\/w\/([a-z0-9][a-z0-9-]*)\/entrar(?:\?espacio=[a-z0-9]{1,40}(?:&fecha=\d{4}-\d{2}-\d{2})?)?$/;

/**
 * El slug de la institución si este `next` es una puerta, o `null`.
 *
 * Estricto a propósito: `next` lo escribe el navegador. Solo pasa la forma exacta
 * `/w/<slug>/entrar`, con el slug limitado al alfabeto de los slugs — nada de barras, puntos,
 * parámetros ni host. Todo lo demás es `null` y sigue el camino de siempre.
 */
export function parseDoorPath(next: string | null | undefined): string | null {
  if (typeof next !== "string") return null;
  const match = PUERTA.exec(next.trim());
  return match?.[1] ?? null;
}

/**
 * La dirección exacta a la que se vuelve después de entrar por una puerta, con la reserva
 * que recordaba si la tenía, o `null` si `next` no es una puerta. Mismo filtro estricto que
 * `parseDoorPath`: sólo `espacio` (un id) y `fecha` (un día), en ese orden.
 */
export function doorReturnPath(next: string | null | undefined): string | null {
  return parseDoorPath(next) ? (next as string).trim() : null;
}

export type DoorDestination =
  /**
   * `activateWorkspaceId` viene cuando el destino es el panel: hay que dejar esa institución
   * activa antes de abrirlo (lo hace `app/w/[workspaceSlug]/entrar/panel/route.ts`, porque la
   * página de la puerta no puede escribir cookies).
   */
  | { redirectTo: string; activateWorkspaceId?: string }
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
  /** La elección recordada (`fotoffice_perfil`). Sólo cuenta si es de esta institución. */
  rememberedKey?: string | null;
}): DoorDestination {
  const aca = input.profiles.filter((p) => p.workspaceId === input.workspaceId);
  if (aca.length === 0) return { unknownHere: true };

  // Todos los perfiles de `aca` son de UNA institución: el mismo criterio que la entrada
  // general — elección recordada válida; si no, dueño/admin al panel; si no, socio al portal;
  // si no, equipo (STAFF sin ficha) al panel.
  const entry = resolveEntryProfile(aca, input.rememberedKey ?? null);
  if (entry.kind !== "go") return { unknownHere: true };
  if (entry.profile.kind === "MEMBER") return { redirectTo: PORTAL_HOME };
  return { redirectTo: "/workspace", activateWorkspaceId: entry.profile.workspaceId };
}
