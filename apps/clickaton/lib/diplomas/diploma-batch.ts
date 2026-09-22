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
 * ciclos de cron pisándose) cree una segunda fila para la misma persona. La
 * base rechaza la segunda con P2002 y `enqueueDiplomaQueueRow` decide qué
 * hacer con eso: si la fila que ya estaba es una que fracasó todas sus
 * veces, la revive (si no, ese diploma queda sin dueño para siempre); si
 * sigue en curso, no hace nada más.
 */
import { createHash } from "node:crypto";
import { prisma } from "@/lib/admin/db";
import { DIPLOMA_CANDIDATE_QUERY, selectDiplomaCandidates } from "./diploma-eligibility";
import { issueDiploma, type IssueDiplomaResult } from "./diploma-service";
import type { DiplomaErrorCode } from "./diploma-types";

/**
 * Lock de la pieza encolada. Tiene que vivir más que `maxDuration` de la
 * ruta del cron (300s, ver `app/api/cron/diplomas/route.ts`): si el lock
 * expirase antes de que termine una tanda larga, la vuelta siguiente podría
 * volver a tomar una fila que todavía se está dibujando. No duplicaría el
 * diploma (`issueDiploma` es idempotente) pero desperdiciaría el trabajo.
 */
const DIPLOMA_QUEUE_LOCK_TTL_MS = 360_000;

/** Placeholder de la fila encolada: todavía no se resolvió ninguna plantilla real. */
const DIPLOMA_QUEUE_TEMPLATE_KEY = "PENDING";
const DIPLOMA_QUEUE_TEMPLATE_VERSION = 0;
const DIPLOMA_QUEUE_RENDERER_VERSION = "PENDING";

/**
 * Tope de reintentos **por ronda de encolado**, no de por vida: cada llamada
 * a `enqueueEditionDiplomas` que revive una fila fallida (ver
 * `enqueueDiplomaQueueRow`) le reinicia el contador a cero. Una edición con
 * la plantilla rota no puede monopolizar la tanda para siempre —
 * `defaultLoadPending` ordena por antigüedad, así que si sus filas son las
 * más viejas y superan `limit`, las de otras ediciones nunca se tomarían—,
 * pero tampoco puede dejar a alguien sin diploma de forma permanente sólo
 * porque la plantilla estuvo rota un rato.
 */
export const DIPLOMA_QUEUE_MAX_ATTEMPTS = 5;

const DIPLOMA_BATCH_LIMIT_DEFAULT = 25;
const DIPLOMA_BATCH_LIMIT_MAX = 100;

function sanitizeBatchLimit(limit: number): number {
  return Math.max(1, Math.min(DIPLOMA_BATCH_LIMIT_MAX, Math.trunc(limit) || DIPLOMA_BATCH_LIMIT_DEFAULT));
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
  /**
   * Ante P2002, revive la fila si (y sólo si) está `FAILED`: la vuelve a
   * `GENERATING` con el contador de intentos en cero. Devuelve `true` si
   * revivió algo, `false` si la fila que ya estaba sigue en curso (no hay
   * nada para revivir ni para duplicar).
   */
  reviveFailed?: (input: { registrationId: string; editionId: string }) => Promise<boolean>;
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

async function defaultReviveFailedQueueRow(input: {
  registrationId: string;
  editionId: string;
}): Promise<boolean> {
  // Mismo patrón que `participant-card-persistence.ts` con STALE/FAILED: no
  // se crea una fila nueva, se revive la que ya existe (contador de
  // intentos a cero, motivo y fecha de fallo limpios). El `where` exige
  // `status: FAILED`: si la fila existente sigue `GENERATING`, esto no
  // matchea nada y `count` da 0 — correcto, ahí no hay nada que revivir.
  const updated = await prisma.clickatonParticipantCard.updateMany({
    where: {
      registrationId: input.registrationId,
      editionId: input.editionId,
      cardType: "DIPLOMA",
      renderHash: buildDiplomaQueueRenderHash(input.registrationId),
      status: "FAILED",
    },
    data: {
      status: "GENERATING",
      attemptCount: 0,
      errorCode: null,
      failedAt: null,
      lockExpiresAt: null,
      startedAt: new Date(),
    },
  });
  return updated.count === 1;
}

/**
 * Crea la fila `GENERATING` de una inscripción. Devuelve `true` si creó una
 * fila nueva o revivió una que había fracasado, `false` si ya había una en
 * curso y no hizo falta tocar nada — esto es lo que de verdad frena el
 * duplicado, no el chequeo previo contra `loadIssuedRegistrationIds` (ese
 * sólo filtra a quien ya tiene el diploma terminado, no a quien ya está
 * encolado).
 */
export async function enqueueDiplomaQueueRow(
  input: { registrationId: string; editionId: string },
  deps: EnqueueDiplomaQueueRowDeps = {}
): Promise<boolean> {
  const create = deps.create ?? defaultCreateQueueRow;
  const reviveFailed = deps.reviveFailed ?? defaultReviveFailedQueueRow;
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
    if (!isPrismaUniqueViolation(err)) throw err;
    // Ya había una fila para esta inscripción. Si fracasó todas sus veces,
    // revivirla (si no, ese diploma queda sin dueño para siempre apenas se
    // arregla lo que la hacía fallar). Si sigue en curso, no hay nada para
    // hacer — no es un duplicado, es la misma fila haciendo su trabajo.
    return reviveFailed(input);
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
  /** `true` = se encoló (nueva o revivida). `false` = ya había una en curso. */
  enqueue?: (registrationId: string) => Promise<boolean>;
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
 * decide quién falta y crea (o revive) su fila `GENERATING`. El
 * procesamiento real lo hace `processDueDiplomas`, de a tandas, desde el cron.
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
    if (created) queued += 1;
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
 * escribir (no sólo en el momento de leer). Con tandas de hasta 300s (ver
 * `maxDuration` de la ruta) el solape entre ciclos de cron de cinco minutos
 * es esperable, no hipotético: si dos ciclos leen la misma fila, sólo el que
 * escribe primero se la queda — el segundo pierde esa fila (su `updateMany`
 * no matchea nada, `count === 0`) y sigue con las demás.
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

export type DiplomaAttemptClosure =
  | { status: "GENERATING"; attemptCount: number; errorCode: DiplomaErrorCode }
  | { status: "FAILED"; attemptCount: number; errorCode: DiplomaErrorCode };

/**
 * Decisión pura ante un fallo de `issueDiploma`: cuántos intentos lleva la
 * pieza y qué motivo tuvo, nada más — ni fecha ni acceso a la base. Antes
 * del tope, sigue disponible para el próximo ciclo (`GENERATING`); al
 * llegar, se cierra (`FAILED`) y deja de tomarse hasta que alguien la
 * reviva (ver `enqueueDiplomaQueueRow`). El motivo (`errorCode`) siempre se
 * conserva: es lo que explica, en el panel, por qué esa persona no tiene
 * diploma todavía.
 */
export function decidirCierreDeIntento(
  attemptCount: number,
  errorCode: DiplomaErrorCode
): DiplomaAttemptClosure {
  const nextAttemptCount = attemptCount + 1;
  if (nextAttemptCount >= DIPLOMA_QUEUE_MAX_ATTEMPTS) {
    return { status: "FAILED", attemptCount: nextAttemptCount, errorCode };
  }
  return { status: "GENERATING", attemptCount: nextAttemptCount, errorCode };
}

async function defaultIssue(input: { registrationId: string }): Promise<IssueDiplomaResult> {
  const result = await issueDiploma(
    { registrationId: input.registrationId, actor: { kind: "admin" } },
    {
      // No-op a propósito: `issueDiploma` sólo admite un admin de sesión
      // real (`requireParticipantCardAdminAccess`), pero este camino no
      // tiene sesión — ya se autorizó a nivel de RUTA (`CRON_SECRET` /
      // `x-vercel-cron`, ver `app/api/cron/diplomas/route.ts`). Se declara
      // acá, en la misma pantalla que el actor de marcador, en vez de
      // fabricar un rol (`globalRole: "SUPER_ADMIN"`) que nadie tiene: no
      // copiar este atajo fuera de este proceso automático.
      checkAccess: () => {},
    }
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

  // No corta el lote (ver módulo).
  const row = await prisma.clickatonParticipantCard.findFirst({
    where: { registrationId: input.registrationId, cardType: "DIPLOMA", status: "GENERATING" },
    select: { id: true, attemptCount: true },
  });
  if (row) {
    const decision = decidirCierreDeIntento(row.attemptCount, result.code);
    await prisma.clickatonParticipantCard.update({
      where: { id: row.id },
      data:
        decision.status === "FAILED"
          ? {
              status: "FAILED",
              failedAt: new Date(),
              attemptCount: decision.attemptCount,
              errorCode: decision.errorCode,
              lockExpiresAt: null,
            }
          : {
              attemptCount: decision.attemptCount,
              errorCode: decision.errorCode,
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
