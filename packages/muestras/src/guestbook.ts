import { addArDays, dayEndAr, toArDay } from "./dates";

/**
 * Libro de visitas digital (etapa 4): el público deja un comentario sin cuenta; quien organiza
 * modera. Modos por muestra (decisión D19):
 *   PUBLISH — se publica al instante y el organizador oculta o borra (por defecto)
 *   REVIEW  — queda pendiente hasta que el organizador lo publica
 *   OFF     — libro cerrado
 */
export const GUESTBOOK_MODES = ["PUBLISH", "REVIEW", "OFF"] as const;
export type GuestbookMode = (typeof GUESTBOOK_MODES)[number];
export const GUESTBOOK_MODE_LABELS: Record<GuestbookMode, string> = {
  PUBLISH: "Los comentarios se publican al instante (podés ocultarlos después)",
  REVIEW: "Revisás cada comentario antes de publicarlo",
  OFF: "Libro cerrado: no recibe comentarios",
};
export const isGuestbookMode = (v: unknown): v is GuestbookMode => (GUESTBOOK_MODES as readonly unknown[]).includes(v);

export const GUESTBOOK_ENTRY_STATUSES = ["PENDING", "PUBLISHED", "HIDDEN"] as const;
export type GuestbookEntryStatus = (typeof GUESTBOOK_ENTRY_STATUSES)[number];
export const GUESTBOOK_ENTRY_STATUS_LABELS: Record<GuestbookEntryStatus, string> = {
  PENDING: "Para revisar",
  PUBLISHED: "Publicado",
  HIDDEN: "Oculto",
};

export const GUESTBOOK_LIMITS = { name: 60, city: 60, comment: 500 } as const;
/** Mucha gente escribe al volver a casa: el libro sigue abierto unos días después del cierre. */
export const GUESTBOOK_DAYS_AFTER_CLOSE = 15;
/** Nadie lee el formulario y escribe un comentario en menos de 3 segundos. */
export const GUESTBOOK_MIN_MS = 3000;

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u2028\u2029]/g;
/**
 * Lo invisible: todo carácter de formato (\p{Cf}: el guion blando, los de ancho cero, las marcas y
 * forzados de dirección como RLO, las etiquetas U+E0000–E007F), más los rellenos que parecen
 * espacio (U+034F, U+115F, U+3164) y los selectores de variación. Los selectores van en su propia
 * clase: mezclados, eslint los toma por letras combinadas.
 */
const INVISIBLES = /[\p{Cf}\u034F\u115F\u3164]|[\uFE00-\uFE0F]/gu;
/** Los forzados de dirección: con ellos "moc.mpas" se ve "spam.com". */
const DE_DERECHA_A_IZQUIERDA = /[\u200F\u061C\u202B\u202E\u2067]/u;
const EMOJI_ANTES = /(?:\p{Extended_Pictographic}|\p{Emoji_Modifier}|\uFE0F)$/u;
const TECLA_ANTES = /(?:\p{Extended_Pictographic}|[0-9#*])$/u;
const EMOJI_DESPUES = /^(?:\p{Extended_Pictographic}|\u20E3)/u;

/**
 * Saca lo invisible pero no rompe los emojis: el unidor (U+200D) de 👩‍💻 y el selector U+FE0F de
 * ❤️ o 1️⃣ se quedan cuando están pegados a un emoji. Para buscar enlaces se usa `sinInvisibles`,
 * que saca todo.
 */
function quitarInvisibles(s: string): string {
  return s.replace(INVISIBLES, (ch: string, i: number) => {
    if (ch !== "\u200D" && ch !== "\uFE0F") return "";
    const antes = s.slice(Math.max(0, i - 4), i);
    const despues = s.slice(i + 1, i + 5);
    if (ch === "\u200D") return EMOJI_ANTES.test(antes) && EMOJI_DESPUES.test(despues) ? ch : "";
    return TECLA_ANTES.test(antes) ? ch : "";
  });
}
const sinInvisibles = (s: string) => s.replace(CONTROL, "").replace(INVISIBLES, "");
const limpio = (v: unknown) => (typeof v === "string" ? quitarInvisibles(v.replace(CONTROL, "")) : "");
const largo = (s: string) => Array.from(s).length;

export type GuestbookInput = { name: string | null; city: string | null; comment: string };

export function guestbookInput(raw: { name?: unknown; city?: unknown; comment?: unknown }): GuestbookInput {
  const linea = (v: unknown) => limpio(v).replace(/\s+/g, " ").trim() || null;
  const comment = limpio(raw.comment).replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return { name: linea(raw.name), city: linea(raw.city), comment };
}

const TLD = "com|net|org|ar|io|info|biz|xyz|ru|cn|ly|site|online|shop|top";
const ENLACE = /https?:\/\/|www\./i;
const CORREO = /[^\s@]+@[^\s@]+\.[a-z]{2,}/i;
/**
 * Un dominio suelto ("spam.com"): en minúsculas y seguido de "/", del fin del texto, de un
 * espacio o de un signo que no tenga una minúscula pegada. Así "Hermosa muestra.Me encantó" o
 * "spam.comentario" no cuentan. `.me` y `.co` sólo con "/" detrás: son palabras.
 *
 * Fuera de alcance (lo modera quien organiza): otros dominios (.tv, .club…), "spam .com" con
 * espacio, mayúsculas ("SPAM.COM") y puntos de ancho completo ("spam．com").
 */
const DOMINIO = new RegExp(`[a-z0-9-]+\\.(?:(?:${TLD})(?=\\/|$|\\s|\\p{P}(?!\\p{Ll}))|(?:me|co)\\/)`, "u");

export function hasLinkOrEmail(s: string): boolean {
  const visto = sinInvisibles(s);
  const lecturas = DE_DERECHA_A_IZQUIERDA.test(s) ? [visto, Array.from(visto).reverse().join("")] : [visto];
  return lecturas.some((t) => ENLACE.test(t) || CORREO.test(t) || DOMINIO.test(t));
}

/**
 * `crudo`: lo que llegó del formulario antes de limpiar. Al limpiar se van los forzados de
 * dirección, y con ellos la pista de que "moc.mpas" se leía "spam.com".
 */
export function guestbookProblems(i: GuestbookInput, crudo: unknown[] = []): string[] {
  const out: string[] = [];
  if (!i.comment) out.push("Escribí un comentario.");
  else if (largo(i.comment) > GUESTBOOK_LIMITS.comment) out.push(`El comentario puede tener hasta ${GUESTBOOK_LIMITS.comment} caracteres.`);
  if (i.name && largo(i.name) > GUESTBOOK_LIMITS.name) out.push(`El nombre puede tener hasta ${GUESTBOOK_LIMITS.name} caracteres.`);
  if (i.city && largo(i.city) > GUESTBOOK_LIMITS.city) out.push(`La ciudad puede tener hasta ${GUESTBOOK_LIMITS.city} caracteres.`);
  const textos = [i.name, i.city, i.comment, ...crudo.filter((v): v is string => typeof v === "string")];
  if (textos.some((t) => t && hasLinkOrEmail(t))) {
    out.push("Los comentarios no pueden llevar enlaces ni direcciones de correo.");
  }
  return out;
}

/** `startedAt`: cuándo se abrió el formulario (milisegundos). Sin dato, se trata como robot. */
export function isTooFast(startedAt: number | null, now: number): boolean {
  if (startedAt == null || !Number.isFinite(startedAt) || startedAt > now + 60_000) return true;
  return now - startedAt < GUESTBOOK_MIN_MS;
}

export type GuestbookState = "OPEN" | "ENDED" | "OFF" | "UNAVAILABLE";

export function guestbookState(
  a: { reviewStatus: string; type: string; isCancelled: boolean; guestbookMode: string; endsAt: Date },
  now: Date,
): GuestbookState {
  if (a.reviewStatus !== "APPROVED" || a.type !== "MUESTRA") return "UNAVAILABLE";
  if (a.isCancelled || a.guestbookMode === "OFF") return "OFF";
  const ultimo = dayEndAr(addArDays(toArDay(a.endsAt), GUESTBOOK_DAYS_AFTER_CLOSE));
  return now.getTime() > ultimo.getTime() ? "ENDED" : "OPEN";
}

export function initialEntryStatus(mode: string): GuestbookEntryStatus {
  return mode === "REVIEW" ? "PENDING" : "PUBLISHED";
}

export type ModerationAction = "publish" | "hide" | "delete";
export const isModerationAction = (v: unknown): v is ModerationAction => v === "publish" || v === "hide" || v === "delete";

/** El estado que deja cada acción; `null` = se borra. */
export function nextEntryStatus(action: ModerationAction): GuestbookEntryStatus | null {
  if (action === "publish") return "PUBLISHED";
  if (action === "hide") return "HIDDEN";
  return null;
}

export function guestbookSignature(e: { name: string | null; city: string | null }): string {
  if (e.name && e.city) return `${e.name}, de ${e.city}`;
  if (e.name) return e.name;
  if (e.city) return `Visitante de ${e.city}`;
  return "Visitante";
}
