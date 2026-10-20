import { MAX_HIGHLIGHTS, MAX_WORKS } from "./constants";

/**
 * Curaduría privada y anónima. Todo puro: decide qué ve un curador, en qué orden, cómo se
 * agregan los puntajes y cómo se arma la muestra con lo elegido.
 *
 * Ideas tomadas del juzgamiento de FotoRank/Clickatón (sin importar su código, que vive en las
 * apps): proyección con lista de campos permitidos y lista de prohibidos vigilada por test,
 * orden estable distinto para cada curador, y códigos anónimos que son la POSICIÓN en un orden
 * por hash (con un hash recortado a 4 dígitos, Clickatón chocó a las 80 obras).
 */

export const SCORE_MIN = 1;
export const SCORE_MAX = 5;

export const WORK_DECISIONS = ["PENDING", "SELECTED", "DISCARDED"] as const;
export type WorkDecision = (typeof WORK_DECISIONS)[number];

export const CURATOR_STATUSES = ["INVITED", "ACTIVE", "REVOKED"] as const;
export type CuratorStatus = (typeof CURATOR_STATUSES)[number];

/** Vigencia de una invitación a curar. */
export const INVITATION_TTL_DAYS = 30;

export function isValidScore(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= SCORE_MIN && n <= SCORE_MAX;
}

export function isWorkDecision(v: unknown): v is WorkDecision {
  return typeof v === "string" && (WORK_DECISIONS as readonly string[]).includes(v);
}

/**
 * Hash de 53 bits (cyrb53), en hexadecimal. No es criptográfico ni hace falta: sólo mezcla el
 * orden. Va sin `node:crypto` porque este paquete también llega al navegador (la barra del panel).
 */
export function stableHash(s: string): string {
  let h1 = 0xdeadbeef ^ 0;
  let h2 = 0x41c6ce57 ^ 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, "0");
}

function byHash<T>(rows: readonly T[], key: (r: T) => string): T[] {
  return rows
    .map((r) => ({ r, k: key(r) }))
    .sort((a, b) => (a.k < b.k ? -1 : a.k > b.k ? 1 : 0))
    .map((x) => x.r);
}

/**
 * Código anónimo de cada obra, asignado de una vez al cerrar la convocatoria: se ordenan las
 * obras por un hash estable (no por fecha de envío ni por autor) y el código es la posición.
 * Únicos por construcción. Ancho mínimo 3 ("O-007").
 */
export function anonymousCodes(callId: string, workIds: readonly string[]): Map<string, string> {
  const ancho = Math.max(3, String(workIds.length).length);
  const orden = byHash([...new Set(workIds)], (id) => stableHash(`muestras-anon:v1:${callId}:${id}`));
  return new Map(orden.map((id, i) => [id, `O-${String(i + 1).padStart(ancho, "0")}`]));
}

/** Orden propio de cada curador: estable entre visitas, distinto entre curadores. */
export function curatorOrder<T extends { id: string }>(rows: readonly T[], curatorId: string, callId: string): T[] {
  return byHash(rows, (r) => stableHash(`muestras-orden:v1:${curatorId}:${callId}:${r.id}`));
}

/**
 * Lo único que un curador ve de una obra. Se arma campo por campo: nunca desde la fila de la
 * base. La imagen va siempre por la ruta propia (`/api/curaduria/obras/<id>/imagen`), porque la
 * URL del bucket lleva el id de quien la subió (`muestras/<userId>/…`).
 */
export type CuratorWorkView = {
  id: string;
  code: string;
  imagePath: string;
  title: string;
  year: number | null;
  technique: string | null;
  statement: string | null;
  myScore: number | null;
  myNote: string;
};

/** Lo que nunca puede viajar al navegador de un curador (ni del organizador antes del cierre). */
export const CURATOR_FORBIDDEN_FIELDS = [
  "userId", "authorName", "authorUserId", "authorProfileId", "email", "name",
  "submissionId", "imageUrl", "createdAt", "updatedAt",
] as const;

export function curatorImagePath(workId: string): string {
  return `/api/curaduria/obras/${encodeURIComponent(workId)}/imagen`;
}

export function toCuratorView(
  w: { id: string; anonymousCode: string | null; title: string; year: number | null; technique: string | null; statement: string | null },
  mine: { score: number; note: string | null } | null,
): CuratorWorkView {
  return {
    id: w.id,
    code: w.anonymousCode ?? "—",
    imagePath: curatorImagePath(w.id),
    title: w.title,
    year: w.year,
    technique: w.technique,
    statement: w.statement,
    myScore: mine?.score ?? null,
    myNote: mine?.note ?? "",
  };
}

/** Devuelve los campos prohibidos que aparecen con valor. Lo usan los tests de la app. */
export function leakedFields(payload: Record<string, unknown>): string[] {
  return CURATOR_FORBIDDEN_FIELDS.filter((k) => k in payload && payload[k] != null && payload[k] !== "");
}

export type CuratorFilter = "TODAS" | "ME_FALTAN" | "PUNTUADAS";

export const CURATOR_FILTERS: ReadonlyArray<{ id: CuratorFilter; label: string }> = [
  { id: "TODAS", label: "Todas" },
  { id: "ME_FALTAN", label: "Me faltan" },
  { id: "PUNTUADAS", label: "Puntuadas" },
];

export function filterForCurator<T extends { myScore: number | null }>(rows: readonly T[], f: CuratorFilter): T[] {
  if (f === "ME_FALTAN") return rows.filter((r) => r.myScore == null);
  if (f === "PUNTUADAS") return rows.filter((r) => r.myScore != null);
  return [...rows];
}

export function curatorProgress(rows: ReadonlyArray<{ myScore: number | null }>): { scored: number; total: number } {
  return { scored: rows.filter((r) => r.myScore != null).length, total: rows.length };
}

export type RankingRow = {
  workId: string;
  code: string;
  average: number | null;
  count: number;
  decision: WorkDecision;
};

/**
 * Ranking para el organizador: promedio (dos decimales) y cantidad de puntajes. Orden: mayor
 * promedio, más puntajes, código. Sin puntajes van al final.
 */
export function rankWorks(
  works: ReadonlyArray<{ id: string; anonymousCode: string | null; decision: string }>,
  scores: ReadonlyArray<{ callWorkId: string; score: number }>,
): RankingRow[] {
  const suma = new Map<string, { total: number; n: number }>();
  for (const s of scores) {
    if (!isValidScore(s.score)) continue;
    const a = suma.get(s.callWorkId) ?? { total: 0, n: 0 };
    a.total += s.score;
    a.n += 1;
    suma.set(s.callWorkId, a);
  }
  const filas: RankingRow[] = works.map((w) => {
    const a = suma.get(w.id);
    return {
      workId: w.id,
      code: w.anonymousCode ?? "—",
      average: a ? Math.round((a.total / a.n) * 100) / 100 : null,
      count: a?.n ?? 0,
      decision: isWorkDecision(w.decision) ? w.decision : "PENDING",
    };
  });
  return filas.sort((x, y) => {
    if (x.average == null && y.average != null) return 1;
    if (y.average == null && x.average != null) return -1;
    if (x.average != null && y.average != null && x.average !== y.average) return y.average - x.average;
    if (x.count !== y.count) return y.count - x.count;
    return x.code < y.code ? -1 : x.code > y.code ? 1 : 0;
  });
}

export type RankingFilter = { minAverage?: number | null; minCount?: number | null; decision?: WorkDecision | "ALL" };

export function filterRanking<R extends RankingRow>(rows: readonly R[], f: RankingFilter): R[] {
  return rows.filter((r) => {
    if (f.minAverage != null && (r.average == null || r.average < f.minAverage)) return false;
    if (f.minCount != null && r.count < f.minCount) return false;
    if (f.decision && f.decision !== "ALL" && r.decision !== f.decision) return false;
    return true;
  });
}

/** Cuántas obras más se pueden seleccionar sin pasarse del tope de la galería. */
export function selectionRoom(existingActivityWorks: number, selected: number): number {
  return Math.max(0, MAX_WORKS - existingActivityWorks - selected);
}

/** Seleccionar y descartar sólo durante la curaduría. */
export function canDecide(status: string): boolean {
  return status === "CURATING";
}

/** Puntuar: curador activo, durante la curaduría. */
export function canScore(p: { status: string; curatorStatus: string }): boolean {
  return p.status === "CURATING" && p.curatorStatus === "ACTIVE";
}

/** El organizador ve quién mandó cada obra recién con la selección cerrada. */
export function canSeeIdentity(status: string): boolean {
  return status === "DONE";
}

/** Quién puede pedir la imagen de una obra por la ruta anónima. */
export function canViewCallImage(p: { status: string; isOwner: boolean; isSuperAdmin: boolean; curatorStatus: string | null }): boolean {
  if (p.status !== "CLOSED" && p.status !== "CURATING" && p.status !== "DONE") return false;
  if (p.isOwner || p.isSuperAdmin) return true;
  return p.curatorStatus === "ACTIVE" && p.status !== "CLOSED";
}

export type InvitationState = "VALID" | "EXPIRED" | "USED" | "REVOKED";

export function invitationState(c: { status: string; invitedAt: Date }, now: Date): InvitationState {
  if (c.status === "REVOKED") return "REVOKED";
  if (c.status === "ACTIVE") return "USED";
  if (now.getTime() - c.invitedAt.getTime() > INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000) return "EXPIRED";
  return "VALID";
}

export function normalizeEmail(raw: string): string | null {
  const e = raw.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 254 ? e : null;
}

export type AssemblySource = {
  callWorkId: string;
  imageUrl: string;
  title: string;
  year: number | null;
  technique: string | null;
  authorName: string;
  authorUserId: number;
  authorProfileId: string | null;
};

export type AssembledWork = Omit<AssemblySource, "callWorkId"> & { callWorkId: string; isHighlight: boolean; sortOrder: number };

/**
 * Las obras seleccionadas, ya en el orden del ranking, como obras de la muestra. Se agregan
 * después de las que la muestra ya tenía. Si la muestra no llegó al tope de destacadas, las
 * mejor puntuadas completan el lugar (el organizador lo cambia después en el editor).
 */
export function assemblyPlan(
  selectedInRankingOrder: readonly AssemblySource[],
  existing: { count: number; highlights: number },
): { works: AssembledWork[]; problems: string[] } {
  const problems: string[] = [];
  if (selectedInRankingOrder.length === 0) problems.push("No hay obras seleccionadas.");
  if (existing.count + selectedInRankingOrder.length > MAX_WORKS) {
    problems.push(
      `La muestra admite hasta ${MAX_WORKS} obras: ya tiene ${existing.count} y seleccionaste ${selectedInRankingOrder.length}. ` +
        "Para hacer lugar, sacá de la galería obras que no vinieron de esta convocatoria, o quitá obras elegidas desde el editor (no se vuelven a agregar).",
    );
  }
  if (problems.length) return { works: [], problems };
  const lugares = Math.max(0, MAX_HIGHLIGHTS - existing.highlights);
  return {
    works: selectedInRankingOrder.map((w, i) => ({ ...w, isHighlight: i < lugares, sortOrder: existing.count + i })),
    problems,
  };
}

/**
 * Marca en `CulturalCallWork.activityWorkId` de una obra elegida que alguien quitó a propósito de
 * la galería desde el editor. Armar la muestra no la vuelve a copiar. No es un id: nunca se usa
 * para armar enlaces a la obra.
 */
export const OBRA_QUITADA_DE_LA_GALERIA = "quitada";

/**
 * Una obra elegida falta copiar a la galería si nunca se copió o si su copia ya no existe (p. ej.
 * se borró por otro camino). Si se quitó a propósito desde el editor, no.
 */
export function needsAssembly(activityWorkId: string | null, galleryIds: ReadonlySet<string>): boolean {
  if (activityWorkId === OBRA_QUITADA_DE_LA_GALERIA) return false;
  return !activityWorkId || !galleryIds.has(activityWorkId);
}

export type GalleryRowInDb = { id: string; isHighlight: boolean; sortOrder: number };

/**
 * Qué hace el editor con la galería al guardar. Sólo se quitan las obras que el editor cargó
 * (`loadedIds`) y ya no manda; las que existen en la base pero el editor no llegó a ver (p. ej.
 * copiadas al armar la muestra con la pestaña abierta) se conservan, en su orden, después de las
 * enviadas. Los topes cuentan las conservadas.
 */
export function editorGalleryPlan(p: {
  current: readonly GalleryRowInDb[];
  loadedIds: readonly string[];
  keptIds: readonly string[];
  submittedCount: number;
  submittedHighlights: number;
}): { removedIds: string[]; preserved: { id: string; sortOrder: number }[]; problems: string[] } {
  const cargadas = new Set(p.loadedIds);
  const quedan = new Set(p.keptIds);
  const removedIds = p.current.filter((w) => cargadas.has(w.id) && !quedan.has(w.id)).map((w) => w.id);
  const conservadas = p.current
    .filter((w) => !cargadas.has(w.id) && !quedan.has(w.id))
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const problems: string[] = [];
  if (conservadas.length) {
    const total = p.submittedCount + conservadas.length;
    const destacadas = p.submittedHighlights + conservadas.filter((w) => w.isHighlight).length;
    const aviso = `Mientras editabas se sumaron ${conservadas.length === 1 ? "1 obra" : `${conservadas.length} obras`} a la galería (por ejemplo, al armar la muestra desde una convocatoria).`;
    if (total > MAX_WORKS) problems.push(`${aviso} Con ellas quedarían ${total} y el tope es ${MAX_WORKS}: recargá la página y sacá las que sobren.`);
    else if (destacadas > MAX_HIGHLIGHTS) problems.push(`${aviso} Con ellas quedarían ${destacadas} destacadas y el tope es ${MAX_HIGHLIGHTS}: recargá la página y ajustá las destacadas.`);
  }
  return {
    removedIds,
    preserved: conservadas.map((w, i) => ({ id: w.id, sortOrder: p.submittedCount + i })),
    problems,
  };
}
