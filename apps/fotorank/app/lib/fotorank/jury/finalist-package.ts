/**
 * ETAPA 16B — Sobre de confirmación de finalistas (§8 master rules).
 * Confirmar = inmutable (salvo revocación auditada vía `revokeFinalist`, que invalida el paquete
 * y exige una nueva confirmación). Habilita preparación de voto público; NUNCA lo activa por sí solo.
 */
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@repo/db";
import { JuryError } from "./errors";
import { assertJuryActivationAllowed } from "./commercial-contest-guard";
import { evaluatePrePublicVoteReadiness } from "./pre-public-vote-readiness";
import { getOrCreateCompetitionJuryConfig } from "./competition-jury-config";
import { enqueueJuryNotificationIntent } from "./notification-intents";

function newId(prefix: string) {
  return `${prefix}${randomBytes(12).toString("hex")}`;
}

async function writePackageAudit(input: {
  contestId: string;
  actorUserId: number;
  eventType: string;
  entityId: string;
  payload?: Record<string, unknown>;
}) {
  const contest = await prisma.fotorankContest.findUnique({
    where: { id: input.contestId },
    select: { organizationId: true },
  });
  if (!contest) return;
  await prisma.fotorankJudgeAuditEvent.create({
    data: {
      organizationId: contest.organizationId,
      contestId: input.contestId,
      actorType: "ADMIN",
      actorUserId: input.actorUserId,
      eventType: input.eventType,
      entityType: "FotorankFinalistPackage",
      entityId: input.entityId,
      payloadJson: (input.payload ?? {}) as object,
    },
  });
}

async function findLatestClosedSession(contestId: string) {
  return prisma.fotorankJuryScoringSession.findFirst({
    where: { contestId, status: { in: ["CLOSED", "LOCKED"] } },
    orderBy: { closedAt: "desc" },
  });
}

/** Prepara (sin confirmar) el paquete: agrupa finalistas activos + snapshot de readiness. */
export async function buildFinalistPackage(input: { contestId: string; scoringSessionId?: string }) {
  const session = input.scoringSessionId
    ? await prisma.fotorankJuryScoringSession.findFirst({
        where: { id: input.scoringSessionId, contestId: input.contestId },
      })
    : await findLatestClosedSession(input.contestId);
  if (!session) throw new JuryError("SESSION_NOT_FOUND", "Sesión de jurado CLOSED no encontrada.", 404);

  const activeSnapshots = await prisma.fotorankFinalistSnapshot.findMany({
    where: { contestId: input.contestId, scoringSessionId: session.id, status: { in: ["DRAFT", "CONFIRMED"] } },
    orderBy: [{ promptExternalId: "asc" }, { internalJuryRank: "asc" }],
  });

  const readiness = await evaluatePrePublicVoteReadiness(input.contestId);

  const existing = await prisma.fotorankFinalistPackage.findFirst({
    where: { contestId: input.contestId, scoringSessionId: session.id },
    orderBy: { createdAt: "desc" },
  });

  const readinessJson = {
    status: readiness.status,
    reasons: readiness.reasons,
    positionsCount: readiness.positionsCount,
    expectedPositionsCount: readiness.expectedPositionsCount,
    computedAt: new Date().toISOString(),
  };

  if (existing && existing.status !== "CONFIRMED") {
    const updated = await prisma.fotorankFinalistPackage.update({
      where: { id: existing.id },
      data: { positionsCount: activeSnapshots.length, readinessJson },
    });
    return { package: updated, snapshots: activeSnapshots, readiness };
  }
  if (existing && existing.status === "CONFIRMED") {
    // No mutar un paquete CONFIRMED; devolver estado actual + readiness fresca informativa.
    return { package: existing, snapshots: activeSnapshots, readiness };
  }

  const created = await prisma.fotorankFinalistPackage.create({
    data: {
      id: newId("ffp"),
      contestId: input.contestId,
      scoringSessionId: session.id,
      status: "DRAFT",
      positionsCount: activeSnapshots.length,
      readinessJson,
    },
  });
  return { package: created, snapshots: activeSnapshots, readiness };
}

function computeConfirmHash(
  snapshots: Array<{ promptExternalId: string; publicCode: string; juryEntrySnapshotId: string }>,
): string {
  const sorted = [...snapshots].sort((a, b) => a.publicCode.localeCompare(b.publicCode));
  const payload = sorted.map((s) => `${s.promptExternalId}:${s.publicCode}:${s.juryEntrySnapshotId}`).join("|");
  return createHash("sha256").update(payload).digest("hex");
}

/**
 * Confirma el paquete de finalistas para preparación de voto público.
 * Requiere `evaluatePrePublicVoteReadiness` en READY_FOR_PUBLIC_VOTE y, para Clickatón, 30 posiciones
 * (prompts × 3). Inmutable tras confirmar: nuevas selecciones deben pasar por `revokeFinalist`.
 */
export async function confirmFinalistsForPublicVote(input: {
  contestId: string;
  actorUserId: number;
  confirmHash?: string | null;
}) {
  assertJuryActivationAllowed(input.contestId);

  const readiness = await evaluatePrePublicVoteReadiness(input.contestId);
  if (readiness.status !== "READY_FOR_PUBLIC_VOTE") {
    throw new JuryError(
      "PUBLIC_VOTE_NOT_READY",
      `No se puede confirmar el paquete de finalistas: ${readiness.reasons.map((r) => r.code).join(", ")}.`,
      409,
    );
  }

  const session = await findLatestClosedSession(input.contestId);
  if (!session) throw new JuryError("SESSION_NOT_FOUND", "Sesión de jurado CLOSED no encontrada.", 404);

  const existingConfirmed = await prisma.fotorankFinalistPackage.findFirst({
    where: { contestId: input.contestId, scoringSessionId: session.id, status: "CONFIRMED" },
  });
  if (existingConfirmed) {
    throw new JuryError("PACKAGE_IMMUTABLE", "Ya hay un paquete de finalistas CONFIRMED para esta sesión.", 409);
  }

  const { package: pkg, snapshots } = await buildFinalistPackage({
    contestId: input.contestId,
    scoringSessionId: session.id,
  });
  if (snapshots.length === 0) {
    throw new JuryError("PACKAGE_INCOMPLETE", "No hay finalistas para confirmar.", 409);
  }

  const confirmHash =
    input.confirmHash ??
    computeConfirmHash(
      snapshots.map((s) => ({
        promptExternalId: s.promptExternalId,
        publicCode: s.publicCode,
        juryEntrySnapshotId: s.juryEntrySnapshotId,
      })),
    );
  const now = new Date();

  const [updatedPackage] = await prisma.$transaction([
    prisma.fotorankFinalistPackage.update({
      where: { id: pkg.id },
      data: {
        status: "CONFIRMED",
        positionsCount: snapshots.length,
        confirmHash,
        confirmedAt: now,
        confirmedByUserId: input.actorUserId,
      },
    }),
    prisma.fotorankFinalistSnapshot.updateMany({
      where: { id: { in: snapshots.map((s) => s.id) } },
      data: { status: "CONFIRMED", confirmedAt: now, confirmedByUserId: input.actorUserId, packageHash: confirmHash },
    }),
  ]);

  await writePackageAudit({
    contestId: input.contestId,
    actorUserId: input.actorUserId,
    eventType: "FINALIST_PACKAGE_CONFIRMED",
    entityId: updatedPackage.id,
    payload: { positionsCount: snapshots.length, confirmHash, scoringSessionId: session.id },
  });

  await enqueueJuryNotificationIntent({
    contestId: input.contestId,
    kind: "PUBLIC_VOTE_READY",
    scoringSessionId: session.id,
    metadata: {
      packageId: updatedPackage.id,
      positionsCount: snapshots.length,
      confirmHash,
      live: false,
    },
  });

  return { package: updatedPackage, positionsCount: snapshots.length, confirmHash };
}

/**
 * Revoca un finalista confirmado (o en borrador) con motivo auditado. Invalida el paquete
 * CONFIRMED asociado (requiere nueva confirmación) y promueve al próximo candidato elegible
 * de la misma consigna, si existe.
 */
export async function revokeFinalist(input: { snapshotId: string; reason: string; actorUserId: number }) {
  if (!input.reason || input.reason.trim().length === 0) {
    throw new JuryError("REASON_REQUIRED", "La revocación de un finalista requiere un motivo.", 400);
  }

  const snapshot = await prisma.fotorankFinalistSnapshot.findUnique({ where: { id: input.snapshotId } });
  if (!snapshot) throw new JuryError("SNAPSHOT_NOT_FOUND_16B", "Finalista no encontrado.", 404);
  if (snapshot.status === "REVOKED") {
    throw new JuryError("SNAPSHOT_ALREADY_REVOKED", "Este finalista ya fue revocado.", 409);
  }
  assertJuryActivationAllowed(snapshot.contestId);

  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    // Liberar el publicCode canónico (histórico se conserva renombrado; único constraint intacto).
    await tx.fotorankFinalistSnapshot.update({
      where: { id: snapshot.id },
      data: {
        status: "REVOKED",
        revokedAt: now,
        revokeReason: input.reason,
        publicCode: `${snapshot.publicCode}::REVOKED:${snapshot.id}`,
      },
    });

    const pkg = await tx.fotorankFinalistPackage.findFirst({
      where: { contestId: snapshot.contestId, scoringSessionId: snapshot.scoringSessionId, status: "CONFIRMED" },
    });
    if (pkg) {
      await tx.fotorankFinalistPackage.update({
        where: { id: pkg.id },
        data: { status: "INVALIDATED" },
      });
    }

    // Candidatos activos de la misma consigna (para excluir ya seleccionados).
    const activeInPrompt = await tx.fotorankFinalistSnapshot.findMany({
      where: {
        contestId: snapshot.contestId,
        scoringSessionId: snapshot.scoringSessionId,
        promptExternalId: snapshot.promptExternalId,
        status: { in: ["DRAFT", "CONFIRMED"] },
      },
      select: { juryEntrySnapshotId: true },
    });
    const alreadySelected = new Set(activeInPrompt.map((s) => s.juryEntrySnapshotId));
    alreadySelected.add(snapshot.juryEntrySnapshotId);

    const session = await tx.fotorankJuryScoringSession.findUniqueOrThrow({
      where: { id: snapshot.scoringSessionId },
    });
    const candidateSnapshots = await tx.fotorankJuryEntrySnapshot.findMany({
      where: {
        admissionBatchId: session.admissionBatchId,
        promptExternalId: snapshot.promptExternalId,
        id: { notIn: [...alreadySelected] },
      },
      select: { id: true, entryId: true, categoryId: true, anonymousCode: true },
    });

    let promoted: { snapshotId: string; finalistSnapshotId: string; publicCode: string } | null = null;
    if (candidateSnapshots.length > 0) {
      const evals = await tx.fotorankJuryEvaluation.findMany({
        where: {
          scoringSessionId: session.id,
          juryEntrySnapshotId: { in: candidateSnapshots.map((c) => c.id) },
          status: { in: ["SUBMITTED", "LOCKED"] },
        },
        select: { juryEntrySnapshotId: true, normalizedScore: true },
      });
      const scoresBySnapshot = new Map<string, number[]>();
      for (const e of evals) {
        if (typeof e.normalizedScore !== "number") continue;
        const arr = scoresBySnapshot.get(e.juryEntrySnapshotId) ?? [];
        arr.push(e.normalizedScore);
        scoresBySnapshot.set(e.juryEntrySnapshotId, arr);
      }
      const ranked = candidateSnapshots
        .map((c) => {
          const scores = scoresBySnapshot.get(c.id) ?? [];
          const avg = scores.length >= session.minimumEvaluationsPerEntry
            ? scores.reduce((a, b) => a + b, 0) / scores.length
            : null;
          return { ...c, avg };
        })
        .filter((c) => c.avg != null)
        .sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0));

      const next = ranked[0];
      if (next) {
        const newFinalist = await tx.fotorankFinalistSnapshot.create({
          data: {
            id: `ffs${randomBytes(12).toString("hex")}`,
            contestId: snapshot.contestId,
            scoringSessionId: snapshot.scoringSessionId,
            resultBatchId: snapshot.resultBatchId,
            promptExternalId: snapshot.promptExternalId,
            promptSequence: snapshot.promptSequence,
            entryId: next.entryId,
            juryEntrySnapshotId: next.id,
            publicCode: `${snapshot.publicCode.split("::")[0]}`,
            internalJuryRank: snapshot.internalJuryRank,
            normalizedScore: next.avg,
            status: "DRAFT",
            metadataJson: { promotedFromSnapshotId: snapshot.id, engineVersion: "finalists-engine-16b" },
          },
        });
        if (snapshot.resultBatchId) {
          await tx.fotorankResultEntry.upsert({
            where: {
              resultBatchId_juryEntrySnapshotId_scopeKey: {
                resultBatchId: snapshot.resultBatchId,
                juryEntrySnapshotId: next.id,
                scopeKey: `PROMPT:${snapshot.promptExternalId}`,
              },
            },
            create: {
              id: `fre${randomBytes(12).toString("hex")}`,
              resultBatchId: snapshot.resultBatchId,
              juryEntrySnapshotId: next.id,
              anonymousCode: next.anonymousCode,
              categoryId: next.categoryId,
              promptExternalId: snapshot.promptExternalId,
              scopeKey: `PROMPT:${snapshot.promptExternalId}`,
              normalizedScore: next.avg,
              evaluationCount: scoresBySnapshot.get(next.id)?.length ?? 0,
              coverageStatus: "COMPLETE",
              preliminaryPosition: snapshot.internalJuryRank,
              finalPosition: null,
              resultStatus: "FINALIST",
              awardType: "FINALIST",
            },
            update: {
              normalizedScore: next.avg,
              resultStatus: "FINALIST",
              awardType: "FINALIST",
              finalPosition: null,
            },
          });
        }
        promoted = { snapshotId: next.id, finalistSnapshotId: newFinalist.id, publicCode: newFinalist.publicCode };
      }
    }

    if (snapshot.resultBatchId) {
      await tx.fotorankResultEntry.updateMany({
        where: { resultBatchId: snapshot.resultBatchId, juryEntrySnapshotId: snapshot.juryEntrySnapshotId },
        data: { resultStatus: "DISQUALIFIED", awardType: null },
      });
    }

    return { promoted, packageInvalidated: Boolean(pkg) };
  });

  await writePackageAudit({
    contestId: snapshot.contestId,
    actorUserId: input.actorUserId,
    eventType: "FINALIST_REVOKED",
    entityId: snapshot.id,
    payload: {
      reason: input.reason,
      promptExternalId: snapshot.promptExternalId,
      originalPublicCode: snapshot.publicCode,
      promoted: result.promoted,
      packageInvalidated: result.packageInvalidated,
    },
  });

  return result;
}

/** Config helper reexportado por conveniencia (evita import duplicado en callers). */
export { getOrCreateCompetitionJuryConfig };
