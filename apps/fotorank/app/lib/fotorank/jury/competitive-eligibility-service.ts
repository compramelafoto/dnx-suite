/**
 * ETAPA 16A — Elegibilidad competitiva (§3 master rules).
 * Congela el corte ELEGIBLE/NO ELEGIBLE por participante, tras cierre de upload + admisión.
 * No crea tablas ClickatonJury*; reutiliza FotorankContestParticipant.metadata + espeja en
 * ClickatonRegistration (competitiveStatus / competitiveValidPromptCount) cuando hay edición vinculada.
 */
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@repo/db";
import { JuryError } from "./errors";
import { getOrCreateCompetitionJuryConfig } from "./competition-jury-config";

function newId() {
  return `fef${randomBytes(12).toString("hex")}`;
}

const VALID_ADMISSION_STATUSES = ["ADMITTED", "FROZEN_FOR_JURY"] as const;

export type CompetitiveStatus = "ELIGIBLE" | "NOT_ELIGIBLE";

type ParticipantMetadata = Record<string, unknown> | null;

function computeRosterHash(
  rows: Array<{ participantId: string; validCount: number; status: CompetitiveStatus }>,
): string {
  const sorted = [...rows].sort((a, b) => a.participantId.localeCompare(b.participantId));
  const payload = sorted.map((r) => `${r.participantId}:${r.validCount}:${r.status}`).join("|");
  return createHash("sha256").update(payload).digest("hex");
}

/**
 * Congela la elegibilidad competitiva de todos los participantes del concurso.
 * Idempotente: si el roster calculado es idéntico al último freeze FROZEN, devuelve ese registro.
 */
export async function freezeCompetitiveEligibility(input: {
  contestId: string;
  admissionBatchId?: string | null;
  actorUserId: number;
  minimumValidEntries: number;
  /** ETAPA 16B — dry-run: calcula rosterHash + counts sin persistir. */
  dryRun?: boolean;
}) {
  if (!Number.isFinite(input.minimumValidEntries) || input.minimumValidEntries < 1) {
    throw new JuryError("INVALID_INPUT", "minimumValidEntries debe ser >= 1.", 400);
  }

  const contest = await prisma.fotorankContest.findUnique({
    where: { id: input.contestId },
    select: { id: true, organizationId: true },
  });
  if (!contest) throw new JuryError("CONTEST_NOT_FOUND", "Concurso no encontrado.", 404);

  if (input.admissionBatchId) {
    const batch = await prisma.fotorankAdmissionBatch.findFirst({
      where: { id: input.admissionBatchId, contestId: input.contestId },
      select: { id: true, status: true },
    });
    if (!batch) throw new JuryError("BATCH_NOT_FOUND", "Lote de admisión no encontrado.", 404);
    if (batch.status !== "FROZEN") {
      throw new JuryError(
        "BATCH_NOT_FROZEN",
        "Solo se puede congelar elegibilidad sobre un lote de admisión FROZEN.",
        409,
      );
    }
  }

  const participants = await prisma.fotorankContestParticipant.findMany({
    where: { contestId: input.contestId, enabled: true },
    select: { id: true, externalRegistrationId: true, metadata: true },
  });

  const entries = await prisma.fotorankContestEntry.findMany({
    where: {
      contestId: input.contestId,
      externalRegistrationId: { not: null },
      withdrawnAt: null,
    },
    select: { externalRegistrationId: true, externalPromptId: true, admissionStatus: true },
  });

  // Válida = obra admitida/congelada para jurado; contamos consignas distintas por inscripción.
  const validPromptsByRegistration = new Map<string, Set<string>>();
  let totalValidEntries = 0;
  let totalTrackedEntries = 0;
  for (const e of entries) {
    if (!e.externalRegistrationId) continue;
    totalTrackedEntries += 1;
    if (!e.admissionStatus || !VALID_ADMISSION_STATUSES.includes(e.admissionStatus as (typeof VALID_ADMISSION_STATUSES)[number])) {
      continue;
    }
    totalValidEntries += 1;
    const key = e.externalRegistrationId;
    const set = validPromptsByRegistration.get(key) ?? new Set<string>();
    if (e.externalPromptId) set.add(e.externalPromptId);
    validPromptsByRegistration.set(key, set);
  }

  const computed = participants.map((p) => {
    const validCount = p.externalRegistrationId
      ? validPromptsByRegistration.get(p.externalRegistrationId)?.size ?? 0
      : 0;
    const status: CompetitiveStatus =
      validCount >= input.minimumValidEntries ? "ELIGIBLE" : "NOT_ELIGIBLE";
    return { participantId: p.id, externalRegistrationId: p.externalRegistrationId, validCount, status };
  });

  const eligibleCount = computed.filter((c) => c.status === "ELIGIBLE").length;
  const notEligibleCount = computed.length - eligibleCount;
  const validEntriesCount = totalValidEntries;
  const excludedEntriesCount = Math.max(0, totalTrackedEntries - totalValidEntries);
  const rosterHash = computeRosterHash(
    computed.map((c) => ({ participantId: c.participantId, validCount: c.validCount, status: c.status })),
  );

  if (input.dryRun) {
    return {
      dryRun: true as const,
      rosterHash,
      eligibleCount,
      notEligibleCount,
      validEntriesCount,
      excludedEntriesCount,
      totalParticipants: computed.length,
      minimumValidEntries: input.minimumValidEntries,
      freeze: null,
      idempotent: false as const,
    };
  }

  const lastFreeze = await prisma.fotorankCompetitiveEligibilityFreeze.findFirst({
    where: { contestId: input.contestId, status: "ELIGIBILITY_FROZEN" },
    orderBy: { configVersion: "desc" },
  });
  if (
    lastFreeze &&
    lastFreeze.rosterHash === rosterHash &&
    lastFreeze.minimumValidEntries === input.minimumValidEntries &&
    (lastFreeze.admissionBatchId ?? null) === (input.admissionBatchId ?? null)
  ) {
    return { freeze: lastFreeze, idempotent: true as const, dryRun: false as const };
  }

  const nextVersion = (lastFreeze?.configVersion ?? 0) + 1;
  const reasonCodes = computed
    .filter((c) => c.status === "NOT_ELIGIBLE")
    .map((c) => ({ participantId: c.participantId, reasonCode: "MINIMUM_VALID_ENTRIES_NOT_REACHED" as const }));

  const freeze = await prisma.$transaction(async (tx) => {
    const created = await tx.fotorankCompetitiveEligibilityFreeze.create({
      data: {
        id: newId(),
        contestId: input.contestId,
        admissionBatchId: input.admissionBatchId ?? null,
        status: "ELIGIBILITY_FROZEN",
        configVersion: nextVersion,
        minimumValidEntries: input.minimumValidEntries,
        totalParticipants: computed.length,
        eligibleCount,
        notEligibleCount,
        validEntriesCount,
        excludedEntriesCount,
        reasonCodesJson: reasonCodes,
        configSnapshotJson: { minimumValidEntries: input.minimumValidEntries },
        rosterHash,
        frozenAt: new Date(),
        frozenByUserId: input.actorUserId,
      },
    });

    for (const c of computed) {
      const participant = participants.find((p) => p.id === c.participantId)!;
      const prevMeta = (participant.metadata as ParticipantMetadata) ?? {};
      const nextMeta = {
        ...prevMeta,
        competitiveStatus: c.status,
        competitiveStatusReason: c.status === "NOT_ELIGIBLE" ? "MINIMUM_VALID_ENTRIES_NOT_REACHED" : null,
        competitiveValidEntriesCount: c.validCount,
        competitiveEligibilityFreezeId: created.id,
        competitiveEligibilityConfigVersion: created.configVersion,
      };
      await tx.fotorankContestParticipant.update({
        where: { id: c.participantId },
        data: { metadata: nextMeta },
      });

      if (c.externalRegistrationId) {
        // updateMany: 0 filas si el regId no es un ClickatonRegistration real (fixtures FR-only).
        await tx.clickatonRegistration.updateMany({
          where: { id: c.externalRegistrationId },
          data: {
            competitiveStatus: c.status,
            competitiveValidPromptCount: c.validCount,
          },
        });
      }
    }

    return created;
  });

  await prisma.fotorankJudgeAuditEvent.create({
    data: {
      organizationId: contest.organizationId,
      contestId: input.contestId,
      actorType: "ADMIN",
      actorUserId: input.actorUserId,
      eventType: "JURY_COMPETITIVE_ELIGIBILITY_FROZEN",
      entityType: "FotorankCompetitiveEligibilityFreeze",
      entityId: freeze.id,
      payloadJson: {
        configVersion: freeze.configVersion,
        totalParticipants: freeze.totalParticipants,
        eligibleCount: freeze.eligibleCount,
        notEligibleCount: freeze.notEligibleCount,
        minimumValidEntries: freeze.minimumValidEntries,
      },
    },
  });

  return { freeze, idempotent: false as const, dryRun: false as const };
}

/** Lista de participantId ELEGIBLE tras el último freeze (o el más reciente disponible). */
export async function listJuryEligibleParticipantIds(contestId: string): Promise<string[]> {
  const rows = await prisma.fotorankContestParticipant.findMany({
    where: {
      contestId,
      enabled: true,
      metadata: { path: ["competitiveStatus"], equals: "ELIGIBLE" },
    },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

/** Config helper reexportado por conveniencia para callers de elegibilidad (evita import duplicado). */
export { getOrCreateCompetitionJuryConfig };
