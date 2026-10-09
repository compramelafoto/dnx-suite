import { dayStartAr, toArDay } from "./dates";

/**
 * Convocatorias: el organizador de una muestra abre un llamado online y los fotógrafos envían
 * obras. Estados como texto (mismo criterio que `CulturalActivity.reviewStatus`).
 *
 *   DRAFT → OPEN → CLOSED → CURATING → DONE
 *
 * OPEN se subdivide con las fechas (hora argentina): todavía no recibe, recibe, terminó el plazo.
 * Esas fases se calculan, no se guardan.
 */
export const CALL_STATUSES = ["DRAFT", "OPEN", "CLOSED", "CURATING", "DONE"] as const;
export type CallStatus = (typeof CALL_STATUSES)[number];

export const CALL_STATUS_LABELS: Record<CallStatus, string> = {
  DRAFT: "Borrador",
  OPEN: "Abierta",
  CLOSED: "Cerrada",
  CURATING: "En curaduría",
  DONE: "Selección terminada",
};

export const SUBMISSION_STATUSES = ["ACTIVE", "WITHDRAWN"] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

/** Tope que puede elegir el organizador para "obras por persona". */
export const MAX_WORKS_PER_PERSON_LIMIT = 10;
export const DEFAULT_WORKS_PER_PERSON = 3;

/** Largos máximos: se recorta en vez de rechazar (mismo criterio que la ficha). */
export const CALL_TEXT_LIMITS = {
  title: 200,
  basesText: 20_000,
  requirementsText: 3_000,
  rightsText: 5_000,
  authorName: 200,
  workTitle: 200,
  technique: 200,
  statement: 600,
  note: 1_000,
} as const;

export function isCallStatus(v: unknown): v is CallStatus {
  return typeof v === "string" && (CALL_STATUSES as readonly string[]).includes(v);
}

export type CallPhase = "DRAFT" | "UPCOMING" | "RECEIVING" | "ENDED" | "CLOSED" | "CURATING" | "DONE";

export type CallDates = { status: string; opensAt: Date; closesAt: Date };

/** En qué momento está la convocatoria. Un estado desconocido se trata como borrador. */
export function callPhase(c: CallDates, now: Date): CallPhase {
  if (c.status === "OPEN") {
    if (now.getTime() < c.opensAt.getTime()) return "UPCOMING";
    if (now.getTime() > c.closesAt.getTime()) return "ENDED";
    return "RECEIVING";
  }
  if (c.status === "CLOSED" || c.status === "CURATING" || c.status === "DONE") return c.status;
  return "DRAFT";
}

/** Lo que se lista en `/convocatorias`. */
export function isListedPhase(p: CallPhase): boolean {
  return p === "UPCOMING" || p === "RECEIVING";
}

/** La página pública existe para todo lo que no es borrador: un enlace compartido no se rompe. */
export function hasPublicPage(p: CallPhase): boolean {
  return p !== "DRAFT";
}

export function acceptsSubmissions(p: CallPhase): boolean {
  return p === "RECEIVING";
}

export const CALL_PHASE_PUBLIC_TEXT: Record<CallPhase, string> = {
  DRAFT: "",
  UPCOMING: "Todavía no recibe obras",
  RECEIVING: "Recibe obras",
  ENDED: "Ya no recibe obras",
  CLOSED: "Ya no recibe obras",
  CURATING: "Selección en curso",
  DONE: "Selección terminada",
};

export type CallDraft = {
  title: string;
  basesText: string;
  rightsText: string;
  opensDay: string;
  closesDay: string;
  maxWorksPerPerson: number;
};

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
function validDay(d: string): boolean {
  if (!DAY_RE.test(d)) return false;
  try {
    dayStartAr(d);
    return true;
  } catch {
    return false;
  }
}

/**
 * Lo que falta para abrir la convocatoria. `today` es el día argentino de hoy (YYYY-MM-DD).
 * Si se pasa `activityStatus` (estado de la muestra), la convocatoria sólo abre con la muestra publicada.
 */
export function missingForOpening(d: CallDraft, today: string, activityStatus?: string): string[] {
  const out: string[] = [];
  if (activityStatus !== undefined && activityStatus !== "APPROVED") out.push("Para abrir la convocatoria, la muestra tiene que estar publicada.");
  if (!d.title.trim()) out.push("Falta el título de la convocatoria.");
  if (!d.basesText.trim()) out.push("Faltan las bases.");
  if (!d.rightsText.trim()) out.push("Falta el texto de autorización de derechos.");
  const desde = validDay(d.opensDay);
  const hasta = validDay(d.closesDay);
  if (!desde) out.push("Falta la fecha en que empieza a recibir obras.");
  if (!hasta) out.push("Falta la fecha de cierre.");
  if (desde && hasta && d.closesDay < d.opensDay) out.push("La fecha de cierre es anterior a la de apertura.");
  if (hasta && d.closesDay < today) out.push("La fecha de cierre ya pasó.");
  if (!Number.isInteger(d.maxWorksPerPerson) || d.maxWorksPerPerson < 1 || d.maxWorksPerPerson > MAX_WORKS_PER_PERSON_LIMIT) {
    out.push(`Cada persona puede enviar entre 1 y ${MAX_WORKS_PER_PERSON_LIMIT} obras.`);
  }
  return out;
}

/**
 * Qué se puede cambiar según el estado. En borrador, todo. Abierta: textos y la fecha de cierre
 * (sólo para estirarla: acortarla le saca tiempo a quien ya estaba preparando su envío). Después
 * del cierre, nada.
 */
export function editableCallFields(status: string): ReadonlyArray<keyof CallDraft | "requirementsText"> {
  if (status === "DRAFT") return ["title", "basesText", "rightsText", "requirementsText", "opensDay", "closesDay", "maxWorksPerPerson"];
  if (status === "OPEN") return ["title", "basesText", "requirementsText", "closesDay"];
  return [];
}

export function closeDayProblem(status: string, previousClosesAt: Date, nextClosesDay: string): string | null {
  if (status !== "OPEN") return null;
  if (!validDay(nextClosesDay)) return "Falta la fecha de cierre.";
  if (nextClosesDay < toArDay(previousClosesAt)) return "Con la convocatoria abierta, la fecha de cierre sólo se puede estirar.";
  return null;
}

export type CallAction = "open" | "close" | "startCuration" | "closeCuration" | "unpublish";

const CALL_TRANSITIONS: Record<CallAction, Partial<Record<CallStatus, CallStatus>>> = {
  open: { DRAFT: "OPEN" },
  close: { OPEN: "CLOSED" },
  startCuration: { CLOSED: "CURATING" },
  closeCuration: { CURATING: "DONE" },
  unpublish: { OPEN: "DRAFT" },
};

export function nextCallStatus(action: CallAction, current: string): CallStatus {
  const next = isCallStatus(current) ? CALL_TRANSITIONS[action][current] : undefined;
  if (!next) throw new Error(`No se puede "${action}" una convocatoria en estado ${current}.`);
  return next;
}

export type CallActor = { userId: number; isSuperAdmin: boolean };
export type CallForAction = CallDates & { ownerUserId: number };
export type CallActionContext = {
  now: Date;
  activeSubmissions: number;
  activeCurators: number;
  works: number;
  missingForOpening: string[];
};
export type CallPermission = { ok: true } | { ok: false; reason: string };

/** Quién puede llevar la convocatoria de un estado al siguiente. */
export function canCallAction(action: CallAction, c: CallForAction, actor: CallActor, ctx: CallActionContext): CallPermission {
  if (!isCallStatus(c.status) || !CALL_TRANSITIONS[action][c.status]) {
    return { ok: false, reason: "La convocatoria no está en un estado que permita esta acción." };
  }
  const esDueno = c.ownerUserId === actor.userId;
  if (!esDueno && !actor.isSuperAdmin) return { ok: false, reason: "Sólo quien organiza la muestra puede hacer esto." };
  switch (action) {
    case "open":
      return ctx.missingForOpening.length ? { ok: false, reason: ctx.missingForOpening.join(" ") } : { ok: true };
    case "close":
      // Cerrar antes de tiempo le saca el plazo a quien estaba por enviar.
      return ctx.now.getTime() > c.closesAt.getTime()
        ? { ok: true }
        : { ok: false, reason: "La convocatoria sigue recibiendo obras hasta la fecha de cierre." };
    case "startCuration":
      if (ctx.works < 1) return { ok: false, reason: "No hay obras para curar." };
      if (ctx.activeCurators < 1) return { ok: false, reason: "Sumá al menos un curador que haya aceptado la invitación." };
      return { ok: true };
    case "closeCuration":
      return { ok: true };
    case "unpublish":
      // Moderación: el super admin la saca de la página pública. El organizador, sólo si nadie envió.
      if (actor.isSuperAdmin) return { ok: true };
      return ctx.activeSubmissions === 0 ? { ok: true } : { ok: false, reason: "Ya hay envíos: no se puede volver a borrador." };
  }
}

export type SubmissionWorkDraft = { imageUrl: string; title: string };
export type SubmissionDraft = {
  authorName: string;
  basesAccepted: boolean;
  rightsAccepted: boolean;
  works: SubmissionWorkDraft[];
};

/** Lo que impide guardar un envío. */
export function submissionProblems(d: SubmissionDraft, maxWorks: number): string[] {
  const out: string[] = [];
  if (!d.authorName.trim()) out.push("Escribí tu nombre como querés que figure si tu obra queda seleccionada.");
  if (d.works.length < 1) out.push("Subí al menos una obra.");
  if (d.works.length > maxWorks) out.push(maxWorks === 1 ? "Esta convocatoria recibe una sola obra por persona." : `Esta convocatoria recibe hasta ${maxWorks} obras por persona.`);
  if (d.works.some((w) => !w.imageUrl)) out.push("Cada obra necesita su imagen.");
  if (d.works.some((w) => !w.title.trim())) out.push("Cada obra necesita un título.");
  if (!d.basesAccepted) out.push("Tenés que aceptar las bases.");
  if (!d.rightsAccepted) out.push("Tenés que aceptar la autorización de derechos.");
  return out;
}

/**
 * Quién no puede enviar a una convocatoria: quien la organiza y quien la cura. Si no, el
 * anonimato no sirve de nada (el organizador vería su propia obra en la selección; un curador
 * reconocería la suya).
 */
export function submitterConflict(p: { isOwner: boolean; isCurator: boolean }): string | null {
  if (p.isOwner) return "Organizás esta convocatoria: no podés enviar obras.";
  if (p.isCurator) return "Sos parte del equipo curatorial: no podés enviar obras.";
  return null;
}

/** Descripción para buscadores: corta en un límite de palabra, sin partir caracteres de dos unidades. */
export function callMetaDescription(basesText: string, fallback: string, max = 160): string {
  const t = basesText.replace(/\s+/g, " ").trim();
  if (!t) return fallback;
  const chars = Array.from(t);
  if (chars.length <= max) return t;
  const corte = chars.slice(0, max).join("");
  const ultimo = corte.lastIndexOf(" ");
  return `${(ultimo > max / 2 ? corte.slice(0, ultimo) : corte).replace(/[\s,.;:]+$/, "")}…`;
}
