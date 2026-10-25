/**
 * Reglas para elegir y publicar obras (spec O6, O13, §5.3). Módulo PURO: sin base ni red.
 */

import type { ConsentBasis } from "./consent-basis";

/**
 * Concursos que se pueden mirar desde la tienda: ya cerraron la carga (juzgando, finalistas,
 * terminados, cerrados o archivados). Uno en inscripción o en borrador no se muestra.
 */
export const STORE_CONTEST_STATUSES = ["COMPLETED", "FINALISTS", "JUDGING", "CLOSED", "ARCHIVED"] as const;

export function isStoreContestStatus(status: string): boolean {
  return (STORE_CONTEST_STATUSES as readonly string[]).includes(status);
}

// ── Premio ──────────────────────────────────────────────────────────────────

export type AwardKind = "WINNER" | "MENTION" | "FINALIST";
export type Award = { kind: AwardKind; label: string };

/** Lotes de resultados que ya se pueden mostrar: cerrados por el jurado o publicados. */
export const SHOWABLE_RESULT_BATCH_STATUSES = ["FINALIZED", "PUBLISHED"] as const;

const TEXTO_PREMIO: Record<string, string> = {
  FIRST_PLACE: "Primer premio",
  SECOND_PLACE: "Segundo premio",
  THIRD_PLACE: "Tercer premio",
  FINALIST: "Finalista",
  HONORABLE_MENTION: "Mención de honor",
  SPECIAL_MENTION: "Mención especial",
  PEOPLE_CHOICE: "Premio del público",
  SPONSOR_AWARD: "Premio de sponsor",
};

const TEXTO_ESTADO: Record<AwardKind, string> = { WINNER: "Premiada", MENTION: "Mención", FINALIST: "Finalista" };

/** Orden: el premio mayor gana si la obra tiene más de un resultado (otra categoría, otro lote). */
const PESO: Record<AwardKind, number> = { WINNER: 3, MENTION: 2, FINALIST: 1 };
const PESO_PREMIO: Record<string, number> = {
  FIRST_PLACE: 9,
  SECOND_PLACE: 8,
  THIRD_PLACE: 7,
  PEOPLE_CHOICE: 6,
  SPONSOR_AWARD: 5,
  HONORABLE_MENTION: 4,
  SPECIAL_MENTION: 3,
  CUSTOM: 2,
  FINALIST: 1,
};

function comoKind(resultStatus: string): AwardKind | null {
  return resultStatus === "WINNER" || resultStatus === "MENTION" || resultStatus === "FINALIST" ? resultStatus : null;
}

/** El texto del premio: el tipo de premio si lo tiene; si no, el estado ("Premiada", "Mención", "Finalista"). */
export function awardLabel(kind: AwardKind, awardType: string | null): string {
  return (awardType && TEXTO_PREMIO[awardType]) || TEXTO_ESTADO[kind];
}

/** El mejor premio de la obra entre sus resultados mostrables. Sin ninguno (o sólo RANKED, etc.) → null. */
export function bestAward(results: readonly { resultStatus: string; awardType: string | null }[]): Award | null {
  let mejor: { kind: AwardKind; awardType: string | null } | null = null;
  for (const r of results) {
    const kind = comoKind(r.resultStatus);
    if (!kind) continue;
    if (
      !mejor ||
      PESO[kind] > PESO[mejor.kind] ||
      (PESO[kind] === PESO[mejor.kind] && (PESO_PREMIO[r.awardType ?? ""] ?? 0) > (PESO_PREMIO[mejor.awardType ?? ""] ?? 0))
    ) {
      mejor = { kind, awardType: r.awardType };
    }
  }
  return mejor ? { kind: mejor.kind, label: awardLabel(mejor.kind, mejor.awardType) } : null;
}

// ── Filtros del listado ─────────────────────────────────────────────────────

export type CatalogFilter = "todas" | "premiadas" | "finalistas";

export function parseCatalogFilter(raw: unknown): CatalogFilter {
  return raw === "premiadas" || raw === "finalistas" ? raw : "todas";
}

/** "Premiadas": premio o mención. "Finalistas": las que quedaron finalistas sin premio. */
export function matchesFilter(award: Award | null, filter: CatalogFilter): boolean {
  if (filter === "todas") return true;
  if (filter === "premiadas") return award?.kind === "WINNER" || award?.kind === "MENTION";
  return award?.kind === "FINALIST";
}

// ── Permiso y publicación, en palabras ──────────────────────────────────────

export function consentLabel(
  consent: { basis: string; status: string; notifiedAt: Date | null } | null,
): string {
  if (!consent) return "Sin pedir";
  switch (consent.status) {
    case "GRANTED":
      return "Aceptó";
    case "DECLINED":
      return "No aceptó";
    case "WITHDRAWN":
      return "Retiró";
  }
  if (consent.notifiedAt === null) return "Correo sin enviar";
  if (consent.status === "NOTIFIED") return "Avisado";
  if (consent.status === "PENDING") return "Pedido";
  return consent.status;
}

export function listingLabel(listing: { status: string } | null): string {
  if (!listing) return "Sin publicar";
  if (listing.status === "PUBLISHED") return "Publicada";
  if (listing.status === "WITHDRAWN") return "Despublicada";
  return "Sin publicar";
}

// ── Lo que muestra la ficha ─────────────────────────────────────────────────

export function artworkTitle(title: string | null, entryNumber: string | null): string {
  return title?.trim() || (entryNumber?.trim() ? `Obra ${entryNumber.trim()}` : "Obra");
}

/**
 * Crédito del autor (O13): se muestra si las bases que aceptó piden atribución o si aceptó
 * expresamente. Nombre: el de su perfil de FotoRank y, si no tiene, el de su cuenta.
 */
export function authorCredit(input: {
  attributionRequired: boolean;
  consent: { basis: ConsentBasis | string; status: string };
  profileDisplayName: string | null;
  userName: string | null;
}): string | null {
  const mostrar = input.attributionRequired || (input.consent.basis === "EXPLICIT" && input.consent.status === "GRANTED");
  if (!mostrar) return null;
  return input.profileDisplayName?.trim() || input.userName?.trim() || null;
}

/** Tamaño del ORIGINAL: el asset activo si es el original; si es un derivado, su original. */
export function originalSizeOf(
  active: {
    kind: string;
    width: number | null;
    height: number | null;
    sourceOriginal?: { kind: string; width: number | null; height: number | null } | null;
  } | null,
): { width: number; height: number } | null {
  const original = active?.kind === "ORIGINAL" ? active : active?.sourceOriginal?.kind === "ORIGINAL" ? active.sourceOriginal : null;
  if (!original?.width || !original.height || original.width <= 0 || original.height <= 0) return null;
  return { width: original.width, height: original.height };
}

/** Marca de agua de la vista previa: "Muestra · <institución>". */
export function previewWatermark(institution: string): string {
  return `Muestra · ${institution.trim() || "FOTOFFICE"}`;
}

// ── Regalía del concurso ────────────────────────────────────────────────────

/** "20", "12,5" o "12.5" → bps (2000, 1250). Entre 0 y 100 %, hasta dos decimales. */
export function parseRoyaltyPercent(raw: string): { ok: true; bps: number } | { ok: false; error: string } {
  const limpio = raw.trim().replace("%", "").trim().replace(",", ".");
  const error = { ok: false as const, error: "La regalía es un porcentaje entre 0 y 100 (hasta dos decimales)." };
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(limpio)) return error;
  const bps = Math.round(Number(limpio) * 100);
  if (!Number.isFinite(bps) || bps < 0 || bps > 10000) return error;
  return { ok: true, bps };
}

/** 2000 → "20", 1250 → "12,5". */
export function royaltyPercentText(bps: number): string {
  return (bps / 100).toLocaleString("es-AR", { maximumFractionDigits: 2 });
}
