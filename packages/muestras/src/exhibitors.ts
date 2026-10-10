import { temporalStatus } from "./dates";
import { formatCm, HANGING_LIMITS } from "./hanging";

/**
 * Expositores por enlace (etapa 6). Quien organiza manda un enlace a las personas que ya eligió;
 * cada una se suma con su cuenta, carga sus obras (la foto que se cuelga y los datos de la ficha) y
 * quien organiza aprueba cada obra o pide cambios. Lo aprobado se copia a `CulturalActivityWork`.
 */
export const EXHIBITOR_LINK_STATUSES = ["OPEN", "CLOSED"] as const;
export type ExhibitorLinkStatus = (typeof EXHIBITOR_LINK_STATUSES)[number];
export const EXHIBITOR_STATUSES = ["ACTIVE", "REMOVED"] as const;
export type ExhibitorStatus = (typeof EXHIBITOR_STATUSES)[number];

/** Topes optativos del enlace (vacío = sin tope). El único fijo es `MAX_WORKS` de la muestra. */
export const EXHIBITOR_LIMITS = { worksPerExhibitor: [1, 300], exhibitors: [1, 300] } as const;
export const SUGGESTED_WORKS_PER_EXHIBITOR = 3;
export const EXHIBITOR_TEXT_LIMITS = {
  displayName: 120,
  title: 160,
  technique: 160,
  statement: 800,
  hangingNotes: 300,
  instructions: 1500,
  reviewNote: 600,
} as const;
export const EDITION_SIZE_MAX = 999;

/**
 * El texto de derechos que acepta quien se suma (spec D3) y su versión. Cambiar el texto obliga a
 * cambiar la versión: el alta exige que el formulario mande la vigente (una página vieja no acepta
 * un texto que ya no es el nuestro). Sin columna para la versión todavía (pendiente en el spec), qué
 * texto aceptó cada persona se deduce de `rightsAcceptedAt` con este historial:
 * - "2026-10-10": vigente desde la etapa 6.
 */
export const RIGHTS_TEXT_VERSION = "2026-10-10";
export const RIGHTS_TEXT =
  "Soy autor/a de las obras que cargo. Autorizo a mostrarlas online según lo que elija la organización y a imprimir fichas, marcos y catálogo.";
/** Pesos, sin centavos. Sólo lo ve la organización hasta que exista la venta (spec D33). */
export const PRICE_MAX_ARS = 100_000_000;
/** El primer daguerrotipo conservado es de 1826: antes no hay fotografías. */
export const EXHIBITOR_WORK_MIN_YEAR = 1826;

export const EDITIONS = ["UNIQUE", "LIMITED", "OPEN", "NA"] as const;
export type Edition = (typeof EDITIONS)[number];
export const isEdition = (v: unknown): v is Edition => typeof v === "string" && (EDITIONS as readonly string[]).includes(v);
export const EDITION_LABELS: Record<Edition, string> = {
  UNIQUE: "Pieza única",
  LIMITED: "Edición limitada",
  OPEN: "Edición abierta",
  NA: "No corresponde",
};

export const EXHIBITOR_WORK_STATUSES = ["DRAFT", "SUBMITTED", "CHANGES_REQUESTED", "APPROVED", "REMOVED"] as const;
export type ExhibitorWorkStatus = (typeof EXHIBITOR_WORK_STATUSES)[number];
export const isExhibitorWorkStatus = (v: unknown): v is ExhibitorWorkStatus =>
  typeof v === "string" && (EXHIBITOR_WORK_STATUSES as readonly string[]).includes(v);
/** Lo que ve quien expone. */
export const EXHIBITOR_WORK_STATUS_LABELS: Record<ExhibitorWorkStatus, string> = {
  DRAFT: "Borrador",
  SUBMITTED: "Enviada, esperando revisión",
  CHANGES_REQUESTED: "Con cambios pedidos",
  APPROVED: "En la muestra",
  REMOVED: "Fuera de la muestra",
};
/** Lo que ve quien organiza. */
export const EXHIBITOR_WORK_STATUS_LABELS_ORGANIZER: Record<ExhibitorWorkStatus, string> = {
  DRAFT: "Borrador de quien expone",
  SUBMITTED: "Para revisar",
  CHANGES_REQUESTED: "Cambios pedidos",
  APPROVED: "Aprobada",
  REMOVED: "Sacada de la muestra",
};

export type ExhibitorLinkState = "OPEN" | "CLOSED" | "EXPIRED" | "UNAVAILABLE";

/**
 * Si el enlace recibe expositores y obras nuevas. Anda con la muestra en cualquier estado de
 * revisión (las obras se juntan antes de mandarla a revisión), pero no si está cancelada, ya
 * cerró o no es una muestra (spec D10).
 */
export function exhibitorLinkState(
  link: { status: string; closesAt: Date | null } | null,
  a: { type: string; reviewStatus: string; isCancelled: boolean; startsAt: Date; endsAt: Date },
  now: Date,
): ExhibitorLinkState {
  if (!link || a.type !== "MUESTRA" || a.isCancelled || temporalStatus(a, now) === "CLOSED") return "UNAVAILABLE";
  if (link.status !== "OPEN") return "CLOSED";
  if (link.closesAt && now.getTime() > link.closesAt.getTime()) return "EXPIRED";
  return "OPEN";
}

const LINK_STATE_PROBLEMS: Record<Exclude<ExhibitorLinkState, "OPEN">, string> = {
  CLOSED: "Este enlace ya no recibe expositores. Escribile a quien organiza.",
  EXPIRED: "Ya pasó la fecha para sumarse a esta muestra. Escribile a quien organiza.",
  UNAVAILABLE: "Esta muestra ya no recibe expositores.",
};

/** Por qué una persona no puede sumarse como expositora; vacío si puede. */
export function exhibitorJoinProblems(p: {
  state: ExhibitorLinkState;
  exhibitors: number;
  maxExhibitors: number | null;
  displayName: string;
  rightsAccepted: boolean;
}): string[] {
  if (p.state !== "OPEN") return [LINK_STATE_PROBLEMS[p.state]];
  if (p.maxExhibitors != null && p.exhibitors >= p.maxExhibitors) {
    return ["Ya se sumaron todas las personas que esta muestra espera. Escribile a quien organiza."];
  }
  const problemas: string[] = [];
  const nombre = p.displayName.trim();
  if (!nombre) problemas.push("Escribí cómo firmás tus obras.");
  else if (nombre.length > EXHIBITOR_TEXT_LIMITS.displayName) problemas.push(`El nombre puede tener hasta ${EXHIBITOR_TEXT_LIMITS.displayName} caracteres.`);
  if (!p.rightsAccepted) problemas.push("Para sumarte tenés que confirmar que sos autor/a y aceptar cómo se muestran tus obras.");
  return problemas;
}

/** El tope optativo de obras por expositor, al sumar una obra nueva. */
export function exhibitorCountProblem(p: { current: number; max: number | null }): string | null {
  if (p.max == null || p.current < p.max) return null;
  return `Podés cargar hasta ${p.max} ${p.max === 1 ? "obra" : "obras"} en esta muestra.`;
}

export type ExhibitorWorkData = {
  imageUrl: string | null;
  title: string;
  year: number | null;
  technique: string | null;
  imageWidthCm: number | null;
  imageHeightCm: number | null;
  frameWidthCm: number | null;
  frameHeightCm: number | null;
  edition: string | null;
  editionNumber?: number | null;
  editionSize?: number | null;
  statement: string | null;
  forSale: boolean;
  priceArs: number | null;
  hangingNotes: string | null;
};

const [CM_MIN, CM_MAX] = HANGING_LIMITS.frame;
const esEntero = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n);

/**
 * Qué le falta o qué está mal en una obra. Un borrador (`forSubmit: false`) se guarda incompleto
 * y sólo se revisa lo cargado; para enviarla se exige todo lo obligatorio (spec D5).
 */
export function exhibitorWorkProblems(w: ExhibitorWorkData, opts: { forSubmit: boolean; now?: Date }): string[] {
  const { forSubmit } = opts;
  const anioMax = (opts.now ?? new Date()).getUTCFullYear() + 1;
  const p: string[] = [];
  const title = w.title.trim();
  const technique = (w.technique ?? "").trim();

  if (forSubmit && !w.imageUrl) p.push("Subí la foto de la obra.");
  if (forSubmit && !title) p.push("Escribí el título.");
  if (title.length > EXHIBITOR_TEXT_LIMITS.title) p.push(`El título puede tener hasta ${EXHIBITOR_TEXT_LIMITS.title} caracteres.`);
  if (w.year == null) {
    if (forSubmit) p.push("Indicá el año.");
  } else if (!esEntero(w.year) || w.year < EXHIBITOR_WORK_MIN_YEAR || w.year > anioMax) p.push("Revisá el año.");
  if (forSubmit && !technique) p.push("Indicá la técnica y el soporte.");
  if (technique.length > EXHIBITOR_TEXT_LIMITS.technique) p.push(`La técnica puede tener hasta ${EXHIBITOR_TEXT_LIMITS.technique} caracteres.`);

  const imagen = [w.imageWidthCm, w.imageHeightCm];
  const marco = [w.frameWidthCm, w.frameHeightCm];
  if (forSubmit && imagen.some((n) => n == null)) p.push("Indicá la medida de la imagen (ancho y alto en cm).");
  if (forSubmit && marco.some((n) => n == null)) p.push("Indicá la medida con marco (ancho y alto en cm).");
  const medidas = [...imagen, ...marco].filter((n): n is number => n != null);
  if (medidas.some((n) => !Number.isFinite(n) || n < CM_MIN || n > CM_MAX)) p.push(`Las medidas van entre ${CM_MIN} y ${CM_MAX} cm por lado.`);
  else if (medidas.length === 4 && (w.frameWidthCm! < w.imageWidthCm! || w.frameHeightCm! < w.imageHeightCm!)) {
    p.push("La medida con marco no puede ser menor que la de la imagen.");
  }

  if (w.edition == null) {
    if (forSubmit) p.push("Indicá la edición.");
  } else if (!isEdition(w.edition)) p.push("Indicá la edición.");
  else if (w.edition === "LIMITED") {
    const n = w.editionNumber ?? null;
    const total = w.editionSize ?? null;
    if (forSubmit || n != null || total != null) {
      const ok = esEntero(n) && esEntero(total) && n >= 1 && n <= total && total <= EDITION_SIZE_MAX;
      if (!ok) p.push("En una edición limitada, el número de la copia va de 1 al total.");
    }
  }

  if ((w.statement ?? "").trim().length > EXHIBITOR_TEXT_LIMITS.statement) {
    p.push(`El texto de la obra puede tener hasta ${EXHIBITOR_TEXT_LIMITS.statement} caracteres.`);
  }
  if (w.priceArs != null) {
    if (!esEntero(w.priceArs) || w.priceArs < 1 || w.priceArs > PRICE_MAX_ARS) p.push("Revisá el precio: va en pesos, sin centavos.");
  } else if (forSubmit && w.forSale) p.push("Si la querés vender, indicá el precio en pesos.");
  if ((w.hangingNotes ?? "").trim().length > EXHIBITOR_TEXT_LIMITS.hangingNotes) {
    p.push(`Las notas para el montaje pueden tener hasta ${EXHIBITOR_TEXT_LIMITS.hangingNotes} caracteres.`);
  }
  return p;
}

export type ExhibitorWorkAction = "edit" | "submit" | "withdraw" | "approve" | "requestChanges" | "remove";
export type ExhibitorWorkTransition = { ok: true; next: ExhibitorWorkStatus } | { ok: false; reason: string };

const no = (reason: string): ExhibitorWorkTransition => ({ ok: false, reason });
const NO_EN_ESTE_ESTADO = "Esa acción no se puede hacer con la obra en este estado.";

/**
 * Estados de una obra del expositor (spec D7). Una obra aprobada queda bloqueada para quien
 * expone: no puede cambiar en silencio algo que ya está impreso en una ficha.
 */
export function exhibitorWorkTransition(
  action: ExhibitorWorkAction,
  status: string,
  ctx: { linkOpen?: boolean; complete?: boolean; activityEditable?: boolean },
): ExhibitorWorkTransition {
  switch (action) {
    case "edit":
      if (status === "DRAFT" || status === "CHANGES_REQUESTED") return { ok: true, next: status };
      if (status === "APPROVED") return no("La obra ya está en la muestra. Si hay que cambiar algo, pedíselo a quien organiza.");
      if (status === "SUBMITTED") return no("La obra ya se envió. Si querés cambiarla, retirala primero.");
      if (status === "REMOVED") return no("La organización sacó esta obra de la muestra.");
      return no(NO_EN_ESTE_ESTADO);
    case "submit":
      if (status === "DRAFT") {
        if (!ctx.linkOpen) return no("El enlace de expositores está cerrado: ya no se reciben obras nuevas.");
      } else if (status !== "CHANGES_REQUESTED") return no(NO_EN_ESTE_ESTADO);
      if (!ctx.complete) return no("Completá los datos obligatorios antes de enviar la obra.");
      return { ok: true, next: "SUBMITTED" };
    case "withdraw":
      return status === "SUBMITTED" ? { ok: true, next: "DRAFT" } : no("Sólo se puede retirar una obra enviada que todavía no se revisó.");
    case "approve":
      if (status !== "SUBMITTED") return no(NO_EN_ESTE_ESTADO);
      if (ctx.activityEditable === false) return no("La muestra está en revisión: esperá a que se revise para sumar obras.");
      return { ok: true, next: "APPROVED" };
    case "requestChanges":
      return status === "SUBMITTED" || status === "APPROVED" ? { ok: true, next: "CHANGES_REQUESTED" } : no(NO_EN_ESTE_ESTADO);
    case "remove":
      return status === "SUBMITTED" || status === "CHANGES_REQUESTED" || status === "APPROVED"
        ? { ok: true, next: "REMOVED" }
        : no(NO_EN_ESTE_ESTADO);
  }
}

type EditionFields = { edition: string | null; editionNumber?: number | null; editionSize?: number | null };

/** "Edición 2/10", "Pieza única", "Edición abierta"; `null` si no corresponde. */
export function editionText(w: EditionFields): string | null {
  switch (w.edition) {
    case "UNIQUE":
      return "Pieza única";
    case "OPEN":
      return "Edición abierta";
    case "LIMITED":
      return w.editionNumber != null && w.editionSize != null ? `Edición ${w.editionNumber}/${w.editionSize}` : "Edición limitada";
    default:
      return null;
  }
}

/** "40 × 60,5 cm" (medida de la imagen); `null` si falta alguna. */
export function sizeText(w: { imageWidthCm: number | null; imageHeightCm: number | null }): string | null {
  if (w.imageWidthCm == null || w.imageHeightCm == null) return null;
  return `${formatCm(w.imageWidthCm)} × ${formatCm(w.imageHeightCm)} cm`;
}

/** La línea de datos de la ficha: "2024. Giclée. 40 × 60,5 cm. Edición 2/10". Nunca el precio. */
export function fichaDetail(
  w: EditionFields & { year: number | null; technique: string | null; imageWidthCm: number | null; imageHeightCm: number | null },
): string {
  return [w.year != null ? String(w.year) : null, w.technique?.trim() || null, sizeText(w), editionText(w)]
    .filter((x): x is string => !!x)
    .join(". ");
}

/** Lo que se copia a `CulturalActivityWork` al aprobar (spec D8). Nunca el precio. */
export function toActivityWork(
  ew: { imageUrl: string | null; title: string; year: number | null; technique: string | null },
  exhibitor: { userId: number; profileId: string | null; displayName: string },
  sortOrder: number,
): {
  imageUrl: string;
  title: string;
  authorName: string;
  authorUserId: number;
  authorProfileId: string | null;
  year: number | null;
  technique: string | null;
  isHighlight: boolean;
  sortOrder: number;
} {
  return {
    imageUrl: ew.imageUrl ?? "",
    title: ew.title.trim(),
    authorName: exhibitor.displayName.trim(),
    authorUserId: exhibitor.userId,
    authorProfileId: exhibitor.profileId,
    year: ew.year,
    technique: ew.technique?.trim() || null,
    isHighlight: false,
    sortOrder,
  };
}

/** Cuántas obras esperan que quien organiza las revise ("3 obras para revisar"). */
export function pendingReviewCount(rows: ReadonlyArray<{ status: string }>): number {
  return rows.filter((r) => r.status === "SUBMITTED").length;
}
