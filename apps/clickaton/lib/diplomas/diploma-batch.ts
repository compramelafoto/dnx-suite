/**
 * Lote de diplomas por edición.
 *
 * Dos pasos separados a propósito:
 *
 * 1. `enqueueEditionDiplomas` — dispara el botón del panel. Sólo lee y crea
 *    filas en estado `GENERATING`; nunca renderiza ni llama a `issueDiploma`.
 *    Una edición con 29 acreditados responde en milisegundos.
 * 2. `processDueDiplomas` — lo corre el cron cada cinco minutos y procesa de
 *    a `limit` piezas por invocación, para no agotar el tiempo de la función
 *    en Vercel (ver `app/api/cron/diplomas/route.ts`, calcado del cron de
 *    placas).
 *
 * La pieza que representa "encolado" es un `ClickatonParticipantCard` con
 * `cardType: DIPLOMA` y `status: GENERATING` (el mismo modelo que welcome/member,
 * con su mismo lock por TTL). No lleva plantilla real todavía —eso lo resuelve
 * `issueDiploma` recién al procesarla— así que sus `templateKey`/`templateVersion`/
 * `rendererVersion` son un placeholder fijo y su `renderHash` es determinístico
 * por inscripción: eso es lo que evita que un doble clic en "encolar" (o dos
 * ciclos de cron pisándose) cree una segunda fila para la misma persona — la
 * base la rechaza con P2002 y `enqueueDiplomaQueueRow` se la traga en silencio.
 */
import { createHash } from "node:crypto";
import { prisma } from "@/lib/admin/db";
import { DIPLOMA_CANDIDATE_QUERY, selectDiplomaCandidates } from "./diploma-eligibility";
import { issueDiploma, type IssueDiplomaResult } from "./diploma-service";
import type { ParticipantCardActor } from "../participant-cards/participant-card-types";

/** Lock de la pieza encolada, igual TTL que welcome/member. */
const DIPLOMA_QUEUE_LOCK_TTL_MS = 120_000;

/** Placeholder de la fila encolada: todavía no se resolvió ninguna plantilla real. */
const DIPLOMA_QUEUE_TEMPLATE_KEY = "PENDING";
const DIPLOMA_QUEUE_TEMPLATE_VERSION = 0;
const DIPLOMA_QUEUE_RENDERER_VERSION = "PENDING";

/**
 * Tope de reintentos por pieza. Una edición con la plantilla rota no puede
 * monopolizar la tanda para siempre: `defaultLoadPending` ordena por
 * antigüedad, así que si sus filas son las más viejas y superan `limit`, las
 * de otras ediciones nunca se tomarían. Pasado el tope, `defaultIssue` marca
 * la fila `FAILED` (deja de aparecer en `GENERATING`) en vez de liberar el
 * lock otra vez.
 */
const DIPLOMA_QUEUE_MAX_ATTEMPTS = 5;

const DIPLOMA_BATCH_LIMIT_DEFAULT = 25;
const DIPLOMA_BATCH_LIMIT_MAX = 100;

function sanitizeBatchLimit(limit: number): number {
  return Math.max(1, Math.min(DIPLOMA_BATCH_LIMIT_MAX, Math.trunc(limit) || DIPLOMA_BATCH_LIMIT_DEFAULT));
}

/**
 * Actor de marcador para el camino del cron: no representa ninguna sesión
 * real, y a propósito no lleva `globalRole`. La puerta de este camino es la
 * autorización de la RUTA (`CRON_SECRET` / `x-vercel-cron`, ver
 * `app/api/cron/diplomas/route.ts`), nunca un rol fabricado — por eso
 * `defaultIssue` no deja correr el `checkAccess` real de `issueDiploma`
 * (que exige un admin de verdad, `requireParticipantCardAdminAccess`): le
 * pasa un `checkAccess` explícito que no hace nada, dejándolo dicho en el
 * código en vez de mentir con un `globalRole: "SUPER_ADMIN"` que ningún
 * proceso automático de Clickatón usa. Mismo criterio que
 * `participant-card-autogenerate.ts`: nunca amplía permisos inventando algo
 * que no existe.
 */
const DIPLOMA_BATCH_ACTOR: ParticipantCardActor = { kind: "admin" };

/** No-op a propósito: ver el comentario de `DIPLOMA_BATCH_ACTOR`. */
function allowDiplomaBatchIssue(): void {
  // La autorización de este camino ya ocurrió en la ruta del cron.
}

function isPrismaUniqueViolation(err: unknown): boolean {
  return Boolean(
    err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: unknown }).code === "P2002"
  );
}

/** Hash determinístico por inscripción: misma inscripción, misma fila encolada. */
export function buildDiplomaQueueRenderHash(registrationId: string): string {
  return createHash("sha256").update(`diploma-queue:${registrationId}`).digest("hex");
}

export type EnqueueDiplomaQueueRowDeps = {
  create?: (data: {
    registrationId: string;
    editionId: string;
    cardType: "DIPLOMA";
    templateKey: string;
    templateVersion: number;
    rendererVersion: string;
    renderHash: string;
    status: "GENERATING";
  }) => Promise<unknown>;
};

async function defaultCreateQueueRow(data: {
  registrationId: string;
  editionId: string;
  cardType: "DIPLOMA";
  templateKey: string;
  templateVersion: number;
  rendererVersion: string;
  renderHash: string;
  status: "GENERATING";
}): Promise<unknown> {
  return prisma.clickatonParticipantCard.create({ data });
}

/**
 * Crea la fila `GENERATING` de una inscripción. Devuelve `true` si la creó,
 * `false` si ya existía (P2002 por el `renderHash` determinístico) — esto es
 * lo que de verdad frena el duplicado, no el chequeo previo contra
 * `loadIssuedRegistrationIds` (ese sólo filtra a quien ya tiene el diploma
 * terminado, no a quien ya está encolado).
 */
export async function enqueueDiplomaQueueRow(
  input: { registrationId: string; editionId: string },
  deps: EnqueueDiplomaQueueRowDeps = {}
): Promise<boolean> {
  const create = deps.create ?? defaultCreateQueueRow;
  try {
    await create({
      registrationId: input.registrationId,
      editionId: input.editionId,
      cardType: "DIPLOMA",
      templateKey: DIPLOMA_QUEUE_TEMPLATE_KEY,
      templateVersion: DIPLOMA_QUEUE_TEMPLATE_VERSION,
      rendererVersion: DIPLOMA_QUEUE_RENDERER_VERSION,
      renderHash: buildDiplomaQueueRenderHash(input.registrationId),
      status: "GENERATING",
    });
    return true;
  } catch (err) {
    // Ya había una fila encolada (o emitida y no borrada a tiempo) para esta
    // inscripción: no es un error, es exactamente lo que "no duplicar" pide.
    if (isPrismaUniqueViolation(err)) return false;
    throw err;
  }
}

export type EnqueueDiplomaCandidate = {
  registrationId: string;
  fullName: string;
  accreditedAt: Date;
};

export type EnqueueEditionDiplomasDeps = {
  loadCandidates?: (editionId: string) => Promise<EnqueueDiplomaCandidate[]>;
  loadIssuedRegistrationIds?: (editionId: string) => Promise<Set<string>>;
  /**
   * `true`/nada (`undefined`) = se encoló. `false` = ya había una fila para
   * esa inscripción y no se creó nada (ver `enqueueDiplomaQueueRow`).
   */
  enqueue?: (registrationId: string) => Promise<boolean | void>;
};

export type EnqueueEditionDiplomasResult = {
  queued: number;
  alreadyIssued: number;
  notEligible: number;
};

async function defaultLoadCandidatesWithEligibility(
  editionId: string
): Promise<{ candidates: EnqueueDiplomaCandidate[]; notEligible: number }> {
  const rows = await prisma.clickatonRegistration.findMany({
    where: { editionId },
    ...DIPLOMA_CANDIDATE_QUERY,
  });
  const candidates = selectDiplomaCandidates(rows).map((c) => ({
    registrationId: c.registrationId,
    fullName: c.fullName,
    accreditedAt: c.accreditedAt,
  }));
  // La consulta ya trajo todas las inscripciones de la edición y
  // `selectDiplomaCandidates` descartó a quien no está acreditado: la resta
  // es gratis, no hace falta otra consulta.
  return { candidates, notEligible: rows.length - candidates.length };
}

async function defaultLoadIssuedRegistrationIds(editionId: string): Promise<Set<string>> {
  const rows = await prisma.clickatonDiplomaIssue.findMany({
    where: { editionId, revokedAt: null },
    select: { registrationId: true },
  });
  return new Set(rows.map((r) => r.registrationId));
}

/** `enqueue` por defecto necesita `editionId`, que sólo conoce quien lo arma. */
function buildDefaultEnqueue(editionId: string): (registrationId: string) => Promise<boolean> {
  return (registrationId: string) => enqueueDiplomaQueueRow({ registrationId, editionId });
}

/**
 * Encola los diplomas pendientes de una edición. No renderiza nada: sólo
 * decide quién falta y crea su fila `GENERATING`. El procesamiento real lo
 * hace `processDueDiplomas`, de a tandas, desde el cron.
 */
export async function enqueueEditionDiplomas(
  editionId: string,
  deps: EnqueueEditionDiplomasDeps = {}
): Promise<EnqueueEditionDiplomasResult> {
  const loadIssuedRegistrationIds =
    deps.loadIssuedRegistrationIds ?? defaultLoadIssuedRegistrationIds;
  const enqueue = deps.enqueue ?? buildDefaultEnqueue(editionId);

  // `notEligible` sólo se puede calcular gratis cuando se usa la consulta
  // real (trae todas las inscripciones, no sólo las elegibles). Con un
  // `loadCandidates` inyectado —los tests, o cualquier otro consumidor que
  // ya filtró por su cuenta— no hay de dónde sacarlo, y queda en 0.
  const [{ candidates, notEligible }, issuedIds] = await Promise.all([
    deps.loadCandidates
      ? deps.loadCandidates(editionId).then((candidates) => ({ candidates, notEligible: 0 }))
      : defaultLoadCandidatesWithEligibility(editionId),
    loadIssuedRegistrationIds(editionId),
  ]);

  let queued = 0;
  let alreadyIssued = 0;

  for (const candidate of candidates) {
    if (issuedIds.has(candidate.registrationId)) {
      alreadyIssued += 1;
      continue;
    }
    const created = await enqueue(candidate.registrationId);
    if (created !== false) queued += 1;
  }

  return { queued, alreadyIssued, notEligible };
}

export type DiplomaPendingRow = { registrationId: string };

export type ProcessDueDiplomasDeps = {
  loadPending?: (limit: number) => Promise<DiplomaPendingRow[]>;
  issue?: (input: { registrationId: string }) => Promise<IssueDiplomaResult>;
};

export type ProcessDueDiplomasResult = {
  scanned: number;
  issued: number;
  failed: number;
};

/**
 * Toma hasta `limit` piezas `GENERATING` de tipo `DIPLOMA` con el lock
 * vencido. La reserva es condicionada: cada fila se reclama con su propio
 * `updateMany`, cuyo `WHERE` vuelve a exigir el lock libre en el momento de
 * escribir (no sólo en el momento de leer). Con tandas de hasta cinco
 * minutos cada cinco minutos el solape entre ciclos de cron es esperable, no
 * hipotético: si dos ciclos leen la misma fila, sólo el que escribe primero
 * se la queda — el segundo pierde esa fila (su `updateMany` no matchea nada,
 * `count === 0`) y sigue con las demás.
 */
async function defaultLoadPending(limit: number): Promise<DiplomaPendingRow[]> {
  const now = new Date();
  const lockExpiresAt = new Date(now.getTime() + DIPLOMA_QUEUE_LOCK_TTL_MS);

  const candidates = await prisma.clickatonParticipantCard.findMany({
    where: {
      cardType: "DIPLOMA",
      status: "GENERATING",
      OR: [{ lockExpiresAt: null }, { lockExpiresAt: { lte: now } }],
    },
    orderBy: { startedAt: "asc" },
    take: limit,
    select: { id: true, registrationId: true },
  });

  if (candidates.length === 0) return [];

  const claims = await Promise.all(
    candidates.map(async (c) => {
      const { count } = await prisma.clickatonParticipantCard.updateMany({
        where: {
          id: c.id,
          OR: [{ lockExpiresAt: null }, { lockExpiresAt: { lte: now } }],
        },
        data: { lockExpiresAt },
      });
      return count === 1 ? { registrationId: c.registrationId } : null;
    })
  );

  return claims.filter((c): c is DiplomaPendingRow => c !== null);
}

async function defaultIssue(input: { registrationId: string }): Promise<IssueDiplomaResult> {
  const result = await issueDiploma(
    { registrationId: input.registrationId, actor: DIPLOMA_BATCH_ACTOR },
    { checkAccess: allowDiplomaBatchIssue }
  );

  if (result.ok) {
    // `issueDiploma` ya guardó la pieza real (con su propio renderHash) vía
    // `upsertCard`. La fila encolada era sólo un lugar en la fila: se borra
    // para no dejar un `GENERATING` fantasma que el próximo cron recoja de nuevo.
    await prisma.clickatonParticipantCard.deleteMany({
      where: { registrationId: input.registrationId, cardType: "DIPLOMA", status: "GENERATING" },
    });
    return result;
  }

  // No corta el lote (ver módulo). Si todavía quedan reintentos, se libera
  // el lock para que el próximo ciclo reintente, igual que welcome/member
  // con un render fallido. Si ya se agotaron, la fila pasa a `FAILED` y deja
  // de aparecer en `GENERATING`: una plantilla rota no puede monopolizar la
  // tanda para siempre a costa de otras ediciones.
  const row = await prisma.clickatonParticipantCard.findFirst({
    where: { registrationId: input.registrationId, cardType: "DIPLOMA", status: "GENERATING" },
    select: { id: true, attemptCount: true },
  });
  if (row) {
    const nextAttempt = row.attemptCount + 1;
    const outOfRetries = nextAttempt >= DIPLOMA_QUEUE_MAX_ATTEMPTS;
    await prisma.clickatonParticipantCard.update({
      where: { id: row.id },
      data: outOfRetries
        ? {
            status: "FAILED",
            failedAt: new Date(),
            attemptCount: nextAttempt,
            errorCode: result.code,
            lockExpiresAt: null,
          }
        : {
            attemptCount: nextAttempt,
            errorCode: result.code,
            lockExpiresAt: null,
          },
    });
  }

  return result;
}

/**
 * Procesa hasta `limit` diplomas pendientes, uno por uno. Un fallo —incluida
 * una excepción cruda de `issue`, no sólo un `{ok:false}`— se cuenta y no
 * corta el resto del lote.
 */
export async function processDueDiplomas(
  limit = DIPLOMA_BATCH_LIMIT_DEFAULT,
  deps: ProcessDueDiplomasDeps = {}
): Promise<ProcessDueDiplomasResult> {
  const loadPending = deps.loadPending ?? defaultLoadPending;
  const issue = deps.issue ?? defaultIssue;

  const pending = await loadPending(sanitizeBatchLimit(limit));

  let issued = 0;
  let failed = 0;

  for (const row of pending) {
    try {
      const result = await issue({ registrationId: row.registrationId });
      if (result.ok) {
        issued += 1;
      } else {
        failed += 1;
      }
    } catch {
      // Un fallo — de `issueDiploma` o de la actualización de la pieza en
      // `defaultIssue` — nunca corta el lote: se cuenta y se sigue.
      failed += 1;
    }
  }

  return { scanned: pending.length, issued, failed };
}
