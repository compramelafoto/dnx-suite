import { MAX_WORKS } from "./constants";

/**
 * Del concurso de FotoRank a la muestra (etapa 7). Reglas puras: qué lote de resultados se usa, qué
 * obras se traen, cómo se escribe el premio, en qué orden van, qué base tiene el permiso de cada autor,
 * cuándo se publica su nombre y cuándo una obra entra a la muestra. Nunca se leen códigos anónimos ni
 * puntajes. Los pesos de premios son los de la tienda de FOTOFFICE (`catalog-rules.ts`), copiados.
 */
export const CONTEST_TIERS = ["WINNER", "MENTION", "FINALIST"] as const;
export type ContestTier = (typeof CONTEST_TIERS)[number];
export const isContestTier = (v: unknown): v is ContestTier => (CONTEST_TIERS as readonly unknown[]).includes(v);
export const CONTEST_TIER_LABELS: Record<ContestTier, string> = { WINNER: "Ganadores", MENTION: "Menciones", FINALIST: "Preseleccionados" };
/** Ganadores y menciones marcados por defecto; los preseleccionados suelen ser muchos (D7). */
export const DEFAULT_CONTEST_TIERS: readonly ContestTier[] = ["WINNER", "MENTION"];
/** Imágenes que se copian por pedido (≈ 3 s cada una). */
export const CONTEST_IMAGE_BATCH = 6;
export const RESERVED_AUTHORSHIP = "Autoría reservada";
export const MARATHON_NOT_SUPPORTED = "Las maratones de Clickatón todavía no se pueden llevar a una muestra. Escribinos y lo vemos.";

/** Texto que acepta el autor. Cambiar el texto obliga a cambiar la versión (como `RIGHTS_TEXT`). */
export const CONTEST_EXHIBIT_TEXT_VERSION = "2026-10-10";
export const CONTEST_EXHIBIT_TEXT =
  "Autorizo a exponer esta obra en la muestra, mostrarla online según lo que elija la organización e imprimir su ficha, su marco y el catálogo, con mi nombre como autor/a.";
export const SALE_CONSENT_TEXT =
  "Acepto que esta obra se ofrezca a la venta. Antes de vender me van a mostrar el precio y el reparto para que los confirme.";

/** Los niveles elegidos, sin repetir, en el orden de siempre. Lo que no es un nivel se descarta. */
export function parseContestTiers(values: readonly unknown[]): ContestTier[] {
  const elegidos = new Set(values.filter(isContestTier));
  return CONTEST_TIERS.filter((t) => elegidos.has(t));
}

// ── Lote de resultados ──────────────────────────────────────────────────────

/** Lotes cerrados por el jurado o publicados: la misma fuente que diplomas, imágenes de ganadores y tienda. */
export const USABLE_BATCH_STATUSES = ["FINALIZED", "PUBLISHED"] as const;

/** El último lote usable (por `finalizedAt`, después `publishedAt`), o null. */
export function pickResultBatch<T extends { status: string; finalizedAt: Date | null; publishedAt: Date | null }>(batches: readonly T[]): T | null {
  const t = (b: T) => (b.finalizedAt ?? b.publishedAt)?.getTime() ?? 0;
  return (
    [...batches]
      .filter((b) => (USABLE_BATCH_STATUSES as readonly string[]).includes(b.status))
      .sort((a, b) => t(b) - t(a) || (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0))[0] ?? null
  );
}

// ── Niveles y premios ───────────────────────────────────────────────────────

const MENCIONES = new Set(["HONORABLE_MENTION", "SPECIAL_MENTION"]);

/** El nivel de un resultado del jurado. Descalificadas y resultados sin premio → null. */
export function tierOf(r: { resultStatus: string; awardType: string | null }): ContestTier | null {
  if (r.resultStatus === "DISQUALIFIED") return null;
  if ((r.awardType && MENCIONES.has(r.awardType)) || r.resultStatus === "MENTION") return "MENTION";
  if (r.awardType === "FINALIST" || r.resultStatus === "FINALIST") return "FINALIST";
  if (r.awardType || r.resultStatus === "WINNER") return "WINNER";
  return null;
}

const PESO_NIVEL: Record<ContestTier, number> = { WINNER: 3, MENTION: 2, FINALIST: 1 };
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
const pesoPremio = (awardType: string | null) => PESO_PREMIO[awardType ?? ""] ?? 0;

export type ContestSelection = { snapshotId: string; categoryId: string; tier: ContestTier; awardType: string | null; position: number | null };

/**
 * Las obras seleccionadas por el jurado: ganadoras, menciones y preseleccionadas, sin descalificadas y
 * una sola vez cada una (si está en dos categorías, con su mejor premio: nivel mayor y después premio mayor).
 */
export function contestSelections(
  resultEntries: readonly { snapshotId: string; categoryId: string; resultStatus: string; awardType: string | null; position: number | null }[],
): ContestSelection[] {
  const porObra = new Map<string, ContestSelection>();
  for (const r of resultEntries) {
    const tier = tierOf(r);
    if (!tier) continue;
    const nueva: ContestSelection = { snapshotId: r.snapshotId, categoryId: r.categoryId, tier, awardType: r.awardType, position: r.position };
    const previa = porObra.get(r.snapshotId);
    if (
      !previa ||
      PESO_NIVEL[tier] > PESO_NIVEL[previa.tier] ||
      (PESO_NIVEL[tier] === PESO_NIVEL[previa.tier] && pesoPremio(r.awardType) > pesoPremio(previa.awardType))
    ) {
      porObra.set(r.snapshotId, nueva);
    }
  }
  return [...porObra.values()];
}

const AWARD_TEXT: Record<string, string> = {
  FIRST_PLACE: "1.er premio",
  SECOND_PLACE: "2.º premio",
  THIRD_PLACE: "3.er premio",
  HONORABLE_MENTION: "Mención de honor",
  SPECIAL_MENTION: "Mención especial",
  PEOPLE_CHOICE: "Premio del público",
  SPONSOR_AWARD: "Premio sponsor",
  CUSTOM: "Premio",
};

export function awardText(tier: ContestTier, awardType: string | null): string {
  if (tier === "FINALIST") return "Preseleccionada";
  return (awardType && AWARD_TEXT[awardType]) || (tier === "MENTION" ? "Mención" : "Premio");
}

/** "1.er premio · Paisaje"; sin categoría si el concurso tiene una sola. */
export function distinctionText(p: { tier: ContestTier; awardType: string | null; categoryName: string | null; singleCategory: boolean }): string {
  const premio = awardText(p.tier, p.awardType);
  const categoria = p.categoryName?.trim();
  return p.singleCategory || !categoria ? premio : `${premio} · ${categoria}`;
}

/** Orden del ranking: categoría (por `sortOrder`), nivel, premio, puesto y título. `rank` va de 0 a n-1. */
export function rankContestWorks<
  T extends { categoryId: string; tier: ContestTier; awardType: string | null; position: number | null; title: string },
>(rows: readonly T[], categories: readonly { id: string; sortOrder: number }[]): (T & { rank: number })[] {
  const ordenCategoria = new Map(categories.map((c) => [c.id, c.sortOrder]));
  const cat = (id: string) => ordenCategoria.get(id) ?? Number.MAX_SAFE_INTEGER;
  const puesto = (p: number | null) => (p == null ? Number.MAX_SAFE_INTEGER : p);
  return [...rows]
    .sort(
      (a, b) =>
        cat(a.categoryId) - cat(b.categoryId) ||
        PESO_NIVEL[b.tier] - PESO_NIVEL[a.tier] ||
        pesoPremio(b.awardType) - pesoPremio(a.awardType) ||
        puesto(a.position) - puesto(b.position) ||
        a.title.localeCompare(b.title, "es"),
    )
    .map((row, rank) => ({ ...row, rank }));
}

// ── Bases que firmó el autor ────────────────────────────────────────────────

export type ContestRights = { allowExhibition: boolean; attributionRequired: boolean };

/** `rights` de la configuración de bases que aceptó el autor, o null si no se puede leer. */
export function rightsFromConfigurationJson(json: unknown): ContestRights | null {
  if (!json || typeof json !== "object") return null;
  const rights = (json as { rights?: unknown }).rights;
  if (!rights || typeof rights !== "object") return null;
  const r = rights as Record<string, unknown>;
  return { allowExhibition: r.allowExhibition === true, attributionRequired: r.attributionRequired === true };
}

export type ExhibitBasis = "RULES" | "EXPLICIT";

/** Decisión de Daniel: sólo `allowExhibition` alcanza para exponer sin un clic; si no, se pide permiso. */
export const exhibitBasisFromRights = (r: { allowExhibition: boolean } | null): ExhibitBasis => (r?.allowExhibition ? "RULES" : "EXPLICIT");

/**
 * D28: FotoRank publica sólo códigos anónimos, así que la muestra es la primera vez que el nombre del
 * autor se hace público. Se muestra con atribución en las bases, confirmación del autor (aceptó o completó
 * "Cómo firmás") o autorización escrita marcada por la organización. Si no, "Autoría reservada".
 */
export function authorCredit(p: {
  attributionRequired: boolean;
  exhibitConsent: string;
  consentBy: string | null;
  signedName: string | null;
  defaultName: string;
}): { show: boolean; name: string } {
  const firmado = p.signedName?.trim() || null;
  const confirmo = !!firmado || (p.exhibitConsent === "ACCEPTED" && (p.consentBy === "AUTHOR" || p.consentBy === "ORGANIZER"));
  if (p.attributionRequired || confirmo) return { show: true, name: firmado ?? p.defaultName };
  return { show: false, name: RESERVED_AUTHORSHIP };
}

// ── Armado ──────────────────────────────────────────────────────────────────

/**
 * Qué hacer al armar o actualizar (D10, D11). `create`: seleccionadas en los niveles elegidos que la
 * muestra todavía no tiene. `update`: las que ya tiene (premio, categoría y orden; nunca la casilla,
 * el título ni los permisos), aunque su nivel ya no esté elegido. `gone`: las que la muestra tiene
 * como vigentes y ya no figuran en los resultados (no se sacan: decide quien organiza). Lo que quien
 * organiza sacó (`include = false`) sigue en `existing`, así que nunca se vuelve a crear.
 */
export function planContestImport<T extends { entryId: string; tier: ContestTier }>(p: {
  selected: readonly T[];
  existing: ReadonlyMap<string, { include: boolean; sourceStatus: string }>;
  tiers: readonly ContestTier[];
  galleryCount: number;
}): { create: T[]; update: T[]; gone: string[]; problems: string[] } {
  const elegidos = new Set(p.tiers);
  const vistas = new Set<string>();
  const create: T[] = [];
  const update: T[] = [];
  for (const s of p.selected) {
    if (vistas.has(s.entryId)) continue;
    vistas.add(s.entryId);
    if (p.existing.has(s.entryId)) update.push(s);
    else if (elegidos.has(s.tier)) create.push(s);
  }
  const gone = [...p.existing.entries()].filter(([id, e]) => e.sourceStatus === "CURRENT" && !vistas.has(id)).map(([id]) => id);

  const problems: string[] = [];
  if (create.length === 0 && update.length === 0 && p.existing.size === 0) {
    problems.push("El concurso no tiene obras en los niveles que elegiste.");
  } else if (p.galleryCount + create.length > MAX_WORKS) {
    problems.push(
      `La muestra admite hasta ${MAX_WORKS} obras: ya tiene ${p.galleryCount} y el concurso suma ${create.length}. Elegí menos niveles o sacá obras de la muestra.`,
    );
  }
  return { create, update, gone, problems };
}

/** D14: una obra del concurso está en la muestra si está marcada, con la imagen copiada y con permiso. */
export function contestWorkInGallery(row: { include: boolean; imageStatus: string; imageUrl: string | null; exhibitConsent: string }): boolean {
  return row.include && row.imageStatus === "COPIED" && !!row.imageUrl && row.exhibitConsent === "ACCEPTED";
}

// ── Permisos del autor ──────────────────────────────────────────────────────

export const CONTEST_CONSENT_ACTIONS = [
  "accept", "decline", "withdraw", "reconsider", "writtenConsent", "askSale", "cancelSale", "acceptSale", "declineSale",
] as const;
export type ContestConsentAction = (typeof CONTEST_CONSENT_ACTIONS)[number];
export const isContestConsentAction = (v: unknown): v is ContestConsentAction => (CONTEST_CONSENT_ACTIONS as readonly unknown[]).includes(v);
/** Las acciones sobre `saleConsent`; el resto cambia `exhibitConsent`. */
export const SALE_CONSENT_ACTIONS: readonly ContestConsentAction[] = ["askSale", "cancelSale", "acceptSale", "declineSale"];

type Transicion = { from: readonly string[]; next: string; by: "AUTHOR" | "ORGANIZER" };
const TRANSICIONES: Record<ContestConsentAction, Transicion> = {
  accept: { from: ["PENDING", "DECLINED", "WITHDRAWN"], next: "ACCEPTED", by: "AUTHOR" },
  decline: { from: ["PENDING"], next: "DECLINED", by: "AUTHOR" },
  withdraw: { from: ["ACCEPTED"], next: "WITHDRAWN", by: "AUTHOR" },
  reconsider: { from: ["DECLINED", "WITHDRAWN"], next: "ACCEPTED", by: "AUTHOR" },
  writtenConsent: { from: ["PENDING"], next: "ACCEPTED", by: "ORGANIZER" },
  askSale: { from: ["NOT_ASKED"], next: "PENDING", by: "ORGANIZER" },
  cancelSale: { from: ["PENDING", "ACCEPTED", "DECLINED"], next: "NOT_ASKED", by: "ORGANIZER" },
  acceptSale: { from: ["PENDING", "DECLINED"], next: "ACCEPTED", by: "AUTHOR" },
  declineSale: { from: ["PENDING", "ACCEPTED"], next: "DECLINED", by: "AUTHOR" },
};

/**
 * Transiciones del permiso de exhibición y de venta. Con la muestra cerrada no se cambia nada. La
 * organización sólo puede marcar una autorización escrita sobre lo pendiente: nunca pisa un "no".
 */
export function contestConsentTransition(
  action: ContestConsentAction,
  row: { exhibitBasis: string; exhibitConsent: string; saleConsent?: string },
  ctx: { closed: boolean },
): { ok: true; next: string; by: "AUTHOR" | "ORGANIZER" } | { ok: false; reason: string } {
  if (ctx.closed) return { ok: false, reason: "La muestra ya cerró." };
  const t = TRANSICIONES[action];
  const actual = SALE_CONSENT_ACTIONS.includes(action) ? (row.saleConsent ?? "NOT_ASKED") : row.exhibitConsent;
  if (!t.from.includes(actual)) return { ok: false, reason: "Esta respuesta ya no corresponde: recargá la página." };
  return { ok: true, next: t.next, by: t.by };
}

/** Cuántas obras esperan una respuesta del autor (exhibición o venta). Las que se sacaron no cuentan. */
export function authorPendingCount(rows: readonly { include: boolean; exhibitConsent: string; saleConsent: string }[]): number {
  return rows.filter((r) => r.include && (r.exhibitConsent === "PENDING" || r.saleConsent === "PENDING")).length;
}

/** Texto listo para WhatsApp (D21). */
export function contestShareMessage(p: { name: string; organization: string; contest: string; url: string }): string {
  return `Hola ${p.name.trim()}, con ${p.organization.trim()} armamos una muestra con obras de ${p.contest.trim()} y queremos exponer la tuya. Entrá con la misma cuenta de FotoRank y confirmá acá: ${p.url}`;
}
