import type { GalleryMode } from "./constants";
import { visibleWorks } from "./gallery";

/** Reglas del perfil público del fotógrafo (`/fotografos/<slug>`). */
export const PROFILE_SLUG_MIN = 3;
export const PROFILE_SLUG_MAX = 40;
/** Direcciones que podrían chocar con rutas propias, hoy o más adelante. */
export const RESERVED_PROFILE_SLUGS = ["nuevo", "editar", "panel", "admin", "buscar", "todos", "perfil"] as const;

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const isReserved = (s: string) => (RESERVED_PROFILE_SLUGS as readonly string[]).includes(s);

function toSlug(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
const cut = (s: string, max: number) => s.slice(0, max).replace(/-+$/g, "");

/** Lo que escribió la persona en "Dirección de tu perfil", llevado a forma de slug. */
export function normalizeProfileSlug(raw: string): string {
  return cut(toSlug(raw), PROFILE_SLUG_MAX);
}

/** El slug que se propone a partir del nombre. Siempre pasa `profileSlugProblem`. */
export function profileSlugBase(displayName: string): string {
  let s = normalizeProfileSlug(displayName);
  if (s.length < PROFILE_SLUG_MIN) s = s ? `${s}-foto` : "fotografo";
  if (isReserved(s)) s = `${s}-foto`;
  return s;
}

/** Qué tiene de malo un slug, en palabras de la persona; `null` si está bien. */
export function profileSlugProblem(slug: string): string | null {
  if (slug.length < PROFILE_SLUG_MIN || slug.length > PROFILE_SLUG_MAX) {
    return `La dirección tiene que tener entre ${PROFILE_SLUG_MIN} y ${PROFILE_SLUG_MAX} caracteres.`;
  }
  if (!SLUG_RE.test(slug)) return "Usá sólo letras sin acentos, números y guiones simples.";
  if (isReserved(slug)) return "Esa dirección está reservada. Elegí otra.";
  return null;
}

/** El primero libre entre `base`, `base-2`, `base-3`… sin pasarse del largo máximo. */
export function freeProfileSlug(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  for (let n = 2; n < 1000; n++) {
    const suffix = `-${n}`;
    const candidate = `${cut(base, PROFILE_SLUG_MAX - suffix.length)}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
  throw new Error("No hay una dirección libre para este nombre.");
}

/** "@usuario" o la URL del perfil → "usuario". `null` si no parece un usuario de Instagram. */
export function normalizeInstagram(raw: string): string | null {
  const s = raw.trim().replace(/^(?:https?:\/\/)?(?:www\.|m\.)?instagram\.com\//i, "").replace(/^@/, "").split(/[/?#]/)[0] ?? "";
  return /^[A-Za-z0-9._]{1,30}$/.test(s) ? s.toLowerCase() : null;
}

/** Una dirección web http(s) con dominio. Sin esquema se asume https. */
export function normalizeWebsite(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname.includes(".")) return null;
    // Una dirección con usuario o contraseña ("https://a:b@sitio.com") se usa para engañar.
    if (u.username || u.password) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function normalizeName(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}

export function sameName(a: string, b: string): boolean {
  const x = normalizeName(a);
  return x !== "" && x === normalizeName(b);
}

/**
 * A qué perfil queda vinculada una obra al guardar.
 *
 * - Un perfil pedido se respeta sólo si existe.
 * - Una obra **nueva** cuyo autor se llama igual que el perfil de quien propuso la muestra se
 *   vincula sola (el caso común: el fotógrafo carga su propia muestra).
 * - Una obra que ya existía y quedó sin perfil no se vuelve a vincular: alguien la desvinculó.
 */
export function resolveAuthorProfileId(
  work: { isNew: boolean; authorName: string; requestedProfileId: string | null },
  existingIds: ReadonlySet<string>,
  own: { id: string; displayName: string } | null,
): string | null {
  if (work.requestedProfileId) return existingIds.has(work.requestedProfileId) ? work.requestedProfileId : null;
  if (work.isNew && own && sameName(work.authorName, own.displayName)) return own.id;
  return null;
}

/**
 * Las obras de un perfil dentro de una muestra, separadas en las que se pueden mostrar y las
 * que la galería todavía reserva para la visita (sólo se cuentan).
 */
export function profileWorksInActivity<
  W extends { id: string; isHighlight: boolean; sortOrder: number; authorProfileId: string | null },
>(
  a: { galleryMode: GalleryMode | string; startsAt: Date; endsAt: Date },
  works: W[],
  profileId: string,
  now: Date,
): { visible: W[]; hiddenCount: number } {
  const mine = works.filter((w) => w.authorProfileId === profileId).sort((x, y) => x.sortOrder - y.sortOrder);
  const shown = new Set(visibleWorks(a, works, now).works.map((w) => w.id));
  const visible = mine.filter((w) => shown.has(w.id));
  return { visible, hiddenCount: mine.length - visible.length };
}
