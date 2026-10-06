/**
 * Qué grupos del menú lateral están desplegados.
 *
 * Con todos los módulos encendidos el menú tenía más de treinta renglones: ahora cada grupo
 * (Socios, Sorteos, Comisión…) se pliega y se despliega tocando su título. Se recuerdan los
 * que la persona dejó abiertos, y el grupo de la pantalla actual se abre solo.
 *
 * Va en cookie y no en `localStorage` por lo mismo que `nav-preference.ts`: el layout la lee
 * antes de dibujar, así el menú no aparece cerrado y se abre de golpe un instante después. No
 * es un dato sensible: son nombres de grupos.
 */

export const NAV_GROUPS_COOKIE = "fo_nav_grupos";

const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;
/** Un título de grupo razonable; lo demás es basura y se ignora. */
const TITULO = /^[\p{L}\p{N} .,&()-]{1,40}$/u;
const MAX_GRUPOS = 30;

/** Lee la cookie. Ausente o rota = ninguno guardado (se abre sólo el de la pantalla actual). */
export function parseOpenGroups(value: string | null | undefined): string[] {
  if (!value) return [];
  let crudo: unknown;
  try {
    crudo = JSON.parse(decodeURIComponent(value));
  } catch {
    return [];
  }
  if (!Array.isArray(crudo)) return [];
  const vistos = new Set<string>();
  for (const t of crudo) {
    if (typeof t === "string" && TITULO.test(t)) vistos.add(t);
    if (vistos.size >= MAX_GRUPOS) break;
  }
  return [...vistos];
}

/** Cadena lista para asignar a `document.cookie`. */
export function serializeOpenGroupsCookie(open: Iterable<string>): string {
  const valor = encodeURIComponent(JSON.stringify([...new Set(open)].filter((t) => TITULO.test(t)).slice(0, MAX_GRUPOS)));
  return `${NAV_GROUPS_COOKIE}=${valor}; Path=/; Max-Age=${ONE_YEAR_IN_SECONDS}; SameSite=Lax`;
}

/** Abre o cierra un grupo. */
export function toggleGroup(open: readonly string[], title: string): string[] {
  return open.includes(title) ? open.filter((t) => t !== title) : [...open, title];
}

/**
 * Los grupos que se ven abiertos: los que la persona dejó abiertos más el de la pantalla
 * actual. El de la pantalla actual se abre siempre al llegar, aunque lo hubiera cerrado antes:
 * si no, entrar desde el buscador a una pantalla dejaría su grupo cerrado y no sabrías dónde
 * estás parado.
 */
export function visibleOpenGroups(saved: readonly string[], activeTitle: string | null): Set<string> {
  const abiertos = new Set(saved);
  if (activeTitle) abiertos.add(activeTitle);
  return abiertos;
}
