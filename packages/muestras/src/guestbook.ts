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
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
// Los selectores de variación (U+FE00–U+FE0F) van en su propia clase: mezclados, eslint los toma por letras combinadas.
const INVISIBLES = /[\u00AD\u200B-\u200D\u2060\uFEFF]|[\uFE00-\uFE0F]/g;
const limpio = (v: unknown) => (typeof v === "string" ? v.replace(CONTROL, "").replace(INVISIBLES, "") : "");
const largo = (s: string) => Array.from(s).length;

export type GuestbookInput = { name: string | null; city: string | null; comment: string };

export function guestbookInput(raw: { name?: unknown; city?: unknown; comment?: unknown }): GuestbookInput {
  const linea = (v: unknown) => limpio(v).replace(/\s+/g, " ").trim() || null;
  const comment = limpio(raw.comment).replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return { name: linea(raw.name), city: linea(raw.city), comment };
}

const ENLACE = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|ar|io|info|biz|xyz|ru|cn|co|me|ly|site|online|shop|top)(\b|\/)|[^\s@]+@[^\s@]+\.[a-z]{2,})/i;

export function hasLinkOrEmail(s: string): boolean {
  return ENLACE.test(s);
}

export function guestbookProblems(i: GuestbookInput): string[] {
  const out: string[] = [];
  if (!i.comment) out.push("Escribí un comentario.");
  else if (largo(i.comment) > GUESTBOOK_LIMITS.comment) out.push(`El comentario puede tener hasta ${GUESTBOOK_LIMITS.comment} caracteres.`);
  if (i.name && largo(i.name) > GUESTBOOK_LIMITS.name) out.push(`El nombre puede tener hasta ${GUESTBOOK_LIMITS.name} caracteres.`);
  if (i.city && largo(i.city) > GUESTBOOK_LIMITS.city) out.push(`La ciudad puede tener hasta ${GUESTBOOK_LIMITS.city} caracteres.`);
  if (hasLinkOrEmail([i.name, i.city, i.comment].filter(Boolean).join(" "))) {
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
