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
 * base la rechaza con P2002 y acá se la ignora en silencio.
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
 * El cron ya se autorizó a nivel de ruta (`CRON_SECRET` / `x-vercel-cron`):
 * no hay sesión de admin detrás. `issueDiploma` sólo admite admins, así que
 * acá se arma un actor de sistema con acceso de admin en vez de tocar la
 * autorización del servicio para un caso que no es de un usuario real.
 */
const DIPLOMA_BATCH_ACTOR: ParticipantCardActor = {
  kind: "admin",
  email: "cron-diplomas@clickaton.internal",
  globalRole: "SUPER_ADMIN",
};

function isPrismaUniqueViolation(err: unknown): boolean {
  return Boolean(
    err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: unknown }).code === "P2002"
  );
}

/** Hash determinístico por inscripción: misma inscripción, misma fila encolada. */
function buildDiplomaQueueRenderHash(registrationId: string): string {
  return createHash("sha256").update(`diploma-queue:${registrationId}`).digest("hex");
}

export type EnqueueDiplomaCandidate = {
  registrationId: string;
  fullName: string;
  accreditedAt: Date;
};

export type EnqueueEditionDiplomasDeps = {
  loadCandidates?: (editionId: string) => Promise<EnqueueDiplomaCandidate[]>;
  loadIssuedRegistrationIds?: (editionId: string) => Promise<Set<string>>;
  enqueue?: (registrationId: string) => Promise<void>;
};

export type EnqueueEditionDiplomasResult = {
  queued: number;
  alreadyIssued: number;
  /**
   * `loadCandidates` ya devuelve sólo acreditados (Task 3 filtra por
   * check-in vigente antes de que este módulo vea la lista), así que acá no
   * hay forma de contar "no elegibles" sin otra consulta aparte. Se deja en
   * 0: el campo queda para no cambiarle la forma a quien consuma este
   * resultado el día que haga falta.
   */
  notEligible: number;
};

async function defaultLoadCandidates(editionId: string): Promise<EnqueueDiplomaCandidate[]> {
  const rows = await prisma.clickatonRegistration.findMany({
    where: { editionId },
    ...DIPLOMA_CANDIDATE_QUERY,
  });
  return selectDiplomaCandidates(rows).map((c) => ({
    registrationId: c.registrationId,
    fullName: c.fullName,
    accreditedAt: c.accreditedAt,
  }));
}

async function defaultLoadIssuedRegistrationIds(editionId: string): Promise<Set<string>> {
  const rows = await prisma.clickatonDiplomaIssue.findMany({
    where: { editionId, revokedAt: null },
    select: { registrationId: true },
  });
  return new Set(rows.map((r) => r.registrationId));
}

/** `enqueue` por defecto necesita `editionId`, que sólo conoce quien lo arma. */
function buildDefaultEnqueue(editionId: string): (registrationId: string) => Promise<void> {
  return async (registrationId: string) => {
    try {
      await prisma.clickatonParticipantCard.create({
        data: {
          registrationId,
          editionId,
          cardType: "DIPLOMA",
          templateKey: DIPLOMA_QUEUE_TEMPLATE_KEY,
          templateVersion: DIPLOMA_QUEUE_TEMPLATE_VERSION,
          rendererVersion: DIPLOMA_QUEUE_RENDERER_VERSION,
          renderHash: buildDiplomaQueueRenderHash(registrationId),
          status: "GENERATING",
        },
      });
    } catch (err) {
      // Ya había una fila encolada (o emitida y no borrada a tiempo) para esta
      // inscripción: no es un error, es exactamente lo que "no duplicar" pide.
      if (isPrismaUniqueViolation(err)) return;
      throw err;
    }
  };
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
  const loadCandidates = deps.loadCandidates ?? defaultLoadCandidates;
  const loadIssuedRegistrationIds =
    deps.loadIssuedRegistrationIds ?? defaultLoadIssuedRegistrationIds;
  const enqueue = deps.enqueue ?? buildDefaultEnqueue(editionId);

  const [candidates, issuedIds] = await Promise.all([
    loadCandidates(editionId),
    loadIssuedRegistrationIds(editionId),
  ]);

  let queued = 0;
  let alreadyIssued = 0;

  for (const candidate of candidates) {
    if (issuedIds.has(candidate.registrationId)) {
      alreadyIssued += 1;
      continue;
    }
    await enqueue(candidate.registrationId);
    queued += 1;
  }

  return { queued, alreadyIssued, notEligible: 0 };
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
 * vencido y se lo reserva (nuevo `lockExpiresAt`) para que otro ciclo de
 * cron superpuesto no la vuelva a tomar mientras ésta la procesa.
 */
async function defaultLoadPending(limit: number): Promise<DiplomaPendingRow[]> {
  const now = new Date();
  const rows = await prisma.clickatonParticipantCard.findMany({
    where: {
      cardType: "DIPLOMA",
      status: "GENERATING",
      OR: [{ lockExpiresAt: null }, { lockExpiresAt: { lte: now } }],
    },
    orderBy: { startedAt: "asc" },
    take: limit,
    select: { id: true, registrationId: true },
  });

  if (rows.length === 0) return [];

  await prisma.clickatonParticipantCard.updateMany({
    where: { id: { in: rows.map((r) => r.id) } },
    data: { lockExpiresAt: new Date(now.getTime() + DIPLOMA_QUEUE_LOCK_TTL_MS) },
  });

  return rows.map((r) => ({ registrationId: r.registrationId }));
}

async function defaultIssue(input: { registrationId: string }): Promise<IssueDiplomaResult> {
  const result = await issueDiploma({
    registrationId: input.registrationId,
    actor: DIPLOMA_BATCH_ACTOR,
  });

  if (result.ok) {
    // `issueDiploma` ya guardó la pieza real (con su propio renderHash) vía
    // `upsertCard`. La fila encolada era sólo un lugar en la fila: se borra
    // para no dejar un `GENERATING` fantasma que el próximo cron recoja de nuevo.
    await prisma.clickatonParticipantCard.deleteMany({
      where: { registrationId: input.registrationId, cardType: "DIPLOMA", status: "GENERATING" },
    });
  } else {
    // No corta el lote (ver módulo): se libera el lock para que el próximo
    // ciclo reintente, igual que welcome/member con un render fallido.
    await prisma.clickatonParticipantCard.updateMany({
      where: { registrationId: input.registrationId, cardType: "DIPLOMA", status: "GENERATING" },
      data: { lockExpiresAt: null, attemptCount: { increment: 1 }, errorCode: result.code },
    });
  }

  return result;
}

/**
 * Procesa hasta `limit` diplomas pendientes, uno por uno. Un fallo se cuenta
 * y no corta el resto del lote (ver constraints de la Task 7).
 */
export async function processDueDiplomas(
  limit = 25,
  deps: ProcessDueDiplomasDeps = {}
): Promise<ProcessDueDiplomasResult> {
  const loadPending = deps.loadPending ?? defaultLoadPending;
  const issue = deps.issue ?? defaultIssue;

  const pending = await loadPending(limit);

  let issued = 0;
  let failed = 0;

  for (const row of pending) {
    const result = await issue({ registrationId: row.registrationId });
    if (result.ok) {
      issued += 1;
    } else {
      failed += 1;
    }
  }

  return { scanned: pending.length, issued, failed };
}
