import { Prisma, prisma } from "@repo/db";
import type { PrizeBundleStatus } from "@/lib/rules-2026/prize-bundles";
import { PartnersDomainError, type DomainErrorCode } from "@repo/partners";
import { ensurePrizeBundleSlots } from "@/lib/rules-2026/prize-bundles";
import {
  enqueueWinnerConfirmedInTx,
  enqueueWinnerRevokedInTx,
} from "@/lib/partners-auto-sync/enqueue";
import { appendPrizeAssignmentAudit, readPrizeAssignmentAudit } from "./audit";
import {
  canCancel,
  canConfirm,
  canDeliver,
  canMarkAvailable,
  canReplace,
  canRevoke,
  type PrizeAssignmentDecision,
  type PrizeAssignmentStateView,
} from "./state";

export type PrizeMutationOk<T extends Record<string, unknown> = Record<string, unknown>> = {
  ok: true;
} & T;

export type PrizeMutationErr = {
  ok: false;
  code: DomainErrorCode;
  message: string;
};

export type PrizeMutationResult<T extends Record<string, unknown> = Record<string, unknown>> =
  | PrizeMutationOk<T>
  | PrizeMutationErr;

function err(code: DomainErrorCode, message: string): PrizeMutationErr {
  return { ok: false, code, message };
}

function stateView(input: {
  bundleStatus: PrizeBundleStatus;
  decision: PrizeAssignmentDecision;
  winnerRegistrationId: string | null;
  deliveredAt: Date | null;
  replacedAt: Date | null;
}): PrizeAssignmentStateView {
  return input;
}

async function loadBundleWithAssignment(bundleId: string) {
  return prisma.clickatonPrizeBundle.findUnique({
    where: { id: bundleId },
    include: { assignments: true },
  });
}

async function requireEdition(editionId: string) {
  const edition = await prisma.clickatonEdition.findUnique({
    where: { id: editionId },
    select: { id: true },
  });
  if (!edition) {
    throw new PartnersDomainError("NOT_FOUND", "Edición no encontrada.");
  }
  return edition;
}

async function requireRegistration(editionId: string, registrationId: string) {
  const reg = await prisma.clickatonRegistration.findFirst({
    where: { id: registrationId, editionId },
    select: { id: true, userId: true, status: true, cancelledAt: true },
  });
  if (!reg) {
    throw new PartnersDomainError("NOT_FOUND", "Inscripción no encontrada en la edición.");
  }
  if (reg.cancelledAt || reg.status === "CANCELLED") {
    throw new PartnersDomainError("INVALID_STATE", "La inscripción está cancelada.");
  }
  return reg;
}

async function ensureAssignmentRow(
  tx: Prisma.TransactionClient,
  input: { editionId: string; bundleId: string; existingId?: string | null },
) {
  if (input.existingId) {
    return input.existingId;
  }
  const created = await tx.clickatonPrizeAssignment.create({
    data: {
      editionId: input.editionId,
      bundleId: input.bundleId,
    },
    select: { id: true },
  });
  return created.id;
}

/**
 * Asegura los N slots de prize bundles (DRAFT) para la edición.
 */
export async function ensureEditionPrizeBundles(input: {
  editionId: string;
  count?: number;
}): Promise<PrizeMutationResult<{ created: number; total: number }>> {
  try {
    await requireEdition(input.editionId);
    const count = input.count ?? 10;
    if (!Number.isInteger(count) || count < 1 || count > 50) {
      return err("VALIDATION", "Cantidad de bundles inválida.");
    }
    const slots = ensurePrizeBundleSlots(count);
    let created = 0;
    await prisma.$transaction(async (tx) => {
      for (const slot of slots) {
        const row = await tx.clickatonPrizeBundle.upsert({
          where: {
            editionId_slot: { editionId: input.editionId, slot: slot.slot },
          },
          create: {
            editionId: input.editionId,
            slot: slot.slot,
            name: `Premio ${slot.slot}`,
            status: "DRAFT",
          },
          update: {},
          select: { id: true, createdAt: true, updatedAt: true },
        });
        if (row.createdAt.getTime() === row.updatedAt.getTime()) {
          created += 1;
        }
        const existing = await tx.clickatonPrizeAssignment.findUnique({
          where: { bundleId: row.id },
          select: { id: true },
        });
        if (!existing) {
          await tx.clickatonPrizeAssignment.create({
            data: { editionId: input.editionId, bundleId: row.id },
          });
        }
      }
    });
    const total = await prisma.clickatonPrizeBundle.count({
      where: { editionId: input.editionId },
    });
    return { ok: true, created, total };
  } catch (e) {
    if (e instanceof PartnersDomainError) return err(e.code, e.message);
    throw e;
  }
}

export async function markPrizeBundleAvailable(input: {
  editionId: string;
  bundleId: string;
  actorUserId?: number | null;
}): Promise<PrizeMutationResult<{ bundleId: string; status: "AVAILABLE" }>> {
  try {
    await requireEdition(input.editionId);
    const bundle = await loadBundleWithAssignment(input.bundleId);
    if (!bundle || bundle.editionId !== input.editionId) {
      return err("NOT_FOUND", "Premio no encontrado.");
    }
    if (!canMarkAvailable({ bundleStatus: bundle.status })) {
      return err("INVALID_STATE", `No se puede marcar disponible desde ${bundle.status}.`);
    }
    const assignment = bundle.assignments[0] ?? null;
    await prisma.$transaction(async (tx) => {
      const moved = await tx.clickatonPrizeBundle.updateMany({
        where: {
          id: bundle.id,
          status: { in: ["DRAFT", "REPLACED"] },
        },
        data: { status: "AVAILABLE" },
      });
      if (moved.count !== 1) {
        throw new PartnersDomainError(
          "CONFLICT",
          "El premio cambió de estado; reintentá.",
        );
      }
      const assignmentId = await ensureAssignmentRow(tx, {
        editionId: input.editionId,
        bundleId: bundle.id,
        existingId: assignment?.id,
      });
      const audit = appendPrizeAssignmentAudit(assignment?.auditJson, {
        entry: {
          action: "BUNDLE_AVAILABLE",
          actorUserId: input.actorUserId ?? null,
          fromDecision: readPrizeAssignmentAudit(assignment?.auditJson).decision,
          toDecision: readPrizeAssignmentAudit(assignment?.auditJson).decision,
          note: "bundle→AVAILABLE",
        },
      });
      await tx.clickatonPrizeAssignment.update({
        where: { id: assignmentId },
        data: { auditJson: audit.json },
      });
    });
    return { ok: true, bundleId: bundle.id, status: "AVAILABLE" };
  } catch (e) {
    if (e instanceof PartnersDomainError) return err(e.code, e.message);
    throw e;
  }
}

export async function confirmClickatonPrizeWinner(input: {
  editionId: string;
  bundleId: string;
  winnerRegistrationId: string;
  winnerEntryId?: string | null;
  promptId?: string | null;
  actorUserId?: number | null;
  note?: string | null;
}): Promise<
  PrizeMutationResult<{
    assignmentId: string;
    winnerVersion: number;
    outboxEventId: string;
  }>
> {
  try {
    await requireEdition(input.editionId);
    const reg = await requireRegistration(input.editionId, input.winnerRegistrationId);
    const bundle = await loadBundleWithAssignment(input.bundleId);
    if (!bundle || bundle.editionId !== input.editionId) {
      return err("NOT_FOUND", "Premio no encontrado.");
    }
    const assignment = bundle.assignments[0] ?? null;
    const auditPrev = readPrizeAssignmentAudit(assignment?.auditJson);
    const view = stateView({
      bundleStatus: bundle.status,
      decision: auditPrev.decision,
      winnerRegistrationId: assignment?.winnerRegistrationId ?? null,
      deliveredAt: assignment?.deliveredAt ?? null,
      replacedAt: assignment?.replacedAt ?? null,
    });
    if (!canConfirm(view)) {
      return err("INVALID_STATE", "No se puede confirmar el ganador en el estado actual.");
    }

    const result = await prisma.$transaction(async (tx) => {
      const moved = await tx.clickatonPrizeBundle.updateMany({
        where: {
          id: bundle.id,
          status: { in: ["AVAILABLE", "REPLACED"] },
        },
        data: { status: "ASSIGNED" },
      });
      if (moved.count !== 1) {
        throw new PartnersDomainError(
          "CONFLICT",
          "El premio cambió de estado; reintentá la confirmación.",
        );
      }

      const assignmentId = await ensureAssignmentRow(tx, {
        editionId: input.editionId,
        bundleId: bundle.id,
        existingId: assignment?.id,
      });
      const current = await tx.clickatonPrizeAssignment.findUniqueOrThrow({
        where: { id: assignmentId },
        select: { auditJson: true },
      });
      const prev = readPrizeAssignmentAudit(current.auditJson);
      const winnerVersion = prev.winnerVersion + 1;
      const audit = appendPrizeAssignmentAudit(current.auditJson, {
        winnerVersion,
        decision: "CONFIRMED",
        entry: {
          action: "CONFIRMED",
          actorUserId: input.actorUserId ?? null,
          winnerRegistrationId: input.winnerRegistrationId,
          note: input.note ?? null,
        },
      });

      await tx.clickatonPrizeAssignment.update({
        where: { id: assignmentId },
        data: {
          winnerRegistrationId: input.winnerRegistrationId,
          winnerEntryId: input.winnerEntryId ?? null,
          promptId: input.promptId ?? null,
          assignedAt: new Date(),
          replacedAt: null,
          deliveredAt: null,
          auditJson: audit.json,
        },
      });

      const outbox = await enqueueWinnerConfirmedInTx(tx, {
        prizeAssignmentId: assignmentId,
        registrationId: input.winnerRegistrationId,
        editionId: input.editionId,
        winnerVersion,
        userId: reg.userId,
        prizeBundleId: bundle.id,
      });

      return {
        assignmentId,
        winnerVersion,
        outboxEventId: outbox.eventId,
      };
    });

    return { ok: true, ...result };
  } catch (e) {
    if (e instanceof PartnersDomainError) return err(e.code, e.message);
    throw e;
  }
}

export async function revokeClickatonPrizeWinner(input: {
  editionId: string;
  bundleId: string;
  actorUserId?: number | null;
  note?: string | null;
}): Promise<
  PrizeMutationResult<{
    assignmentId: string;
    winnerVersion: number;
    outboxEventId: string | null;
  }>
> {
  try {
    await requireEdition(input.editionId);
    const bundle = await loadBundleWithAssignment(input.bundleId);
    if (!bundle || bundle.editionId !== input.editionId) {
      return err("NOT_FOUND", "Premio no encontrado.");
    }
    const assignment = bundle.assignments[0] ?? null;
    if (!assignment) {
      return err("NOT_FOUND", "Asignación no encontrada.");
    }
    const auditPrev = readPrizeAssignmentAudit(assignment.auditJson);
    const view = stateView({
      bundleStatus: bundle.status,
      decision: auditPrev.decision,
      winnerRegistrationId: assignment.winnerRegistrationId,
      deliveredAt: assignment.deliveredAt,
      replacedAt: assignment.replacedAt,
    });
    if (!canRevoke(view)) {
      return err("INVALID_STATE", "No se puede revocar el ganador en el estado actual.");
    }
    const previousWinnerRegistrationId = assignment.winnerRegistrationId!;

    const result = await prisma.$transaction(async (tx) => {
      const moved = await tx.clickatonPrizeBundle.updateMany({
        where: {
          id: bundle.id,
          status: { in: ["ASSIGNED", "DELIVERED"] },
        },
        data: { status: "AVAILABLE" },
      });
      if (moved.count !== 1) {
        throw new PartnersDomainError(
          "CONFLICT",
          "El premio cambió de estado; reintentá la revocación.",
        );
      }

      const current = await tx.clickatonPrizeAssignment.findUniqueOrThrow({
        where: { id: assignment.id },
        select: { auditJson: true },
      });
      const prev = readPrizeAssignmentAudit(current.auditJson);
      const winnerVersion = prev.winnerVersion + 1;
      const audit = appendPrizeAssignmentAudit(current.auditJson, {
        winnerVersion,
        decision: "REVOKED",
        entry: {
          action: "REVOKED",
          actorUserId: input.actorUserId ?? null,
          previousWinnerRegistrationId,
          winnerRegistrationId: null,
          note: input.note ?? null,
        },
      });

      await tx.clickatonPrizeAssignment.update({
        where: { id: assignment.id },
        data: {
          winnerRegistrationId: null,
          winnerEntryId: null,
          deliveredAt: null,
          replacedAt: new Date(),
          auditJson: audit.json,
        },
      });

      const outbox = await enqueueWinnerRevokedInTx(tx, {
        prizeAssignmentId: assignment.id,
        registrationId: previousWinnerRegistrationId,
        editionId: input.editionId,
        winnerVersion,
        previousWinnerRegistrationId,
        prizeBundleId: bundle.id,
      });

      return {
        assignmentId: assignment.id,
        winnerVersion,
        outboxEventId: outbox.eventId,
      };
    });

    return { ok: true, ...result };
  } catch (e) {
    if (e instanceof PartnersDomainError) return err(e.code, e.message);
    throw e;
  }
}

export async function replaceClickatonPrizeWinner(input: {
  editionId: string;
  bundleId: string;
  newWinnerRegistrationId: string;
  winnerEntryId?: string | null;
  promptId?: string | null;
  actorUserId?: number | null;
  note?: string | null;
}): Promise<
  PrizeMutationResult<{
    assignmentId: string;
    winnerVersion: number;
    revokedEventId: string;
    confirmedEventId: string;
  }>
> {
  try {
    await requireEdition(input.editionId);
    const newReg = await requireRegistration(
      input.editionId,
      input.newWinnerRegistrationId,
    );
    const bundle = await loadBundleWithAssignment(input.bundleId);
    if (!bundle || bundle.editionId !== input.editionId) {
      return err("NOT_FOUND", "Premio no encontrado.");
    }
    const assignment = bundle.assignments[0] ?? null;
    if (!assignment?.winnerRegistrationId) {
      return err("NOT_FOUND", "Asignación con ganador no encontrada.");
    }
    if (assignment.winnerRegistrationId === input.newWinnerRegistrationId) {
      return err("VALIDATION", "El nuevo ganador es el mismo que el actual.");
    }
    const auditPrev = readPrizeAssignmentAudit(assignment.auditJson);
    const view = stateView({
      bundleStatus: bundle.status,
      decision: auditPrev.decision,
      winnerRegistrationId: assignment.winnerRegistrationId,
      deliveredAt: assignment.deliveredAt,
      replacedAt: assignment.replacedAt,
    });
    if (!canReplace(view)) {
      return err("INVALID_STATE", "No se puede reemplazar el ganador en el estado actual.");
    }

    const previousWinnerRegistrationId = assignment.winnerRegistrationId;

    const result = await prisma.$transaction(async (tx) => {
      const moved = await tx.clickatonPrizeBundle.updateMany({
        where: {
          id: bundle.id,
          status: { in: ["ASSIGNED", "DELIVERED"] },
        },
        data: { status: "ASSIGNED" },
      });
      if (moved.count !== 1) {
        throw new PartnersDomainError(
          "CONFLICT",
          "El premio cambió de estado; reintentá el reemplazo.",
        );
      }

      const current = await tx.clickatonPrizeAssignment.findUniqueOrThrow({
        where: { id: assignment.id },
        select: { auditJson: true },
      });
      const prev = readPrizeAssignmentAudit(current.auditJson);
      const winnerVersion = prev.winnerVersion + 1;
      const audit = appendPrizeAssignmentAudit(current.auditJson, {
        winnerVersion,
        decision: "CONFIRMED",
        entry: {
          action: "REPLACED",
          actorUserId: input.actorUserId ?? null,
          previousWinnerRegistrationId,
          winnerRegistrationId: input.newWinnerRegistrationId,
          note: input.note ?? null,
        },
      });

      await tx.clickatonPrizeAssignment.update({
        where: { id: assignment.id },
        data: {
          winnerRegistrationId: input.newWinnerRegistrationId,
          winnerEntryId: input.winnerEntryId ?? null,
          promptId: input.promptId ?? null,
          assignedAt: new Date(),
          replacedAt: new Date(),
          deliveredAt: null,
          auditJson: audit.json,
        },
      });

      const revoked = await enqueueWinnerRevokedInTx(tx, {
        prizeAssignmentId: assignment.id,
        registrationId: previousWinnerRegistrationId,
        editionId: input.editionId,
        winnerVersion,
        previousWinnerRegistrationId,
        prizeBundleId: bundle.id,
        versionSuffix: "replaced-old",
      });
      const confirmed = await enqueueWinnerConfirmedInTx(tx, {
        prizeAssignmentId: assignment.id,
        registrationId: input.newWinnerRegistrationId,
        editionId: input.editionId,
        winnerVersion,
        userId: newReg.userId,
        prizeBundleId: bundle.id,
        versionSuffix: "replaced-new",
      });

      return {
        assignmentId: assignment.id,
        winnerVersion,
        revokedEventId: revoked.eventId,
        confirmedEventId: confirmed.eventId,
      };
    });

    return { ok: true, ...result };
  } catch (e) {
    if (e instanceof PartnersDomainError) return err(e.code, e.message);
    throw e;
  }
}

export async function cancelClickatonPrizeAssignment(input: {
  editionId: string;
  bundleId: string;
  actorUserId?: number | null;
  note?: string | null;
}): Promise<
  PrizeMutationResult<{
    assignmentId: string;
    winnerVersion: number;
    outboxEventId: string | null;
  }>
> {
  try {
    await requireEdition(input.editionId);
    const bundle = await loadBundleWithAssignment(input.bundleId);
    if (!bundle || bundle.editionId !== input.editionId) {
      return err("NOT_FOUND", "Premio no encontrado.");
    }
    const assignment = bundle.assignments[0] ?? null;
    if (!assignment) {
      return err("NOT_FOUND", "Asignación no encontrada.");
    }
    const auditPrev = readPrizeAssignmentAudit(assignment.auditJson);
    const view = stateView({
      bundleStatus: bundle.status,
      decision: auditPrev.decision,
      winnerRegistrationId: assignment.winnerRegistrationId,
      deliveredAt: assignment.deliveredAt,
      replacedAt: assignment.replacedAt,
    });
    if (!canCancel(view)) {
      return err("INVALID_STATE", "No se puede cancelar la asignación en el estado actual.");
    }

    const previousWinnerRegistrationId = assignment.winnerRegistrationId;
    const wasConfirmed = auditPrev.decision === "CONFIRMED";

    const result = await prisma.$transaction(async (tx) => {
      const fromStatuses: PrizeBundleStatus[] =
        auditPrev.decision === "PROPOSED"
          ? ["AVAILABLE", "ASSIGNED"]
          : ["ASSIGNED"];
      const moved = await tx.clickatonPrizeBundle.updateMany({
        where: {
          id: bundle.id,
          status: { in: fromStatuses },
        },
        data: { status: "AVAILABLE" },
      });
      if (moved.count !== 1 && auditPrev.decision !== "PROPOSED") {
        throw new PartnersDomainError(
          "CONFLICT",
          "El premio cambió de estado; reintentá la cancelación.",
        );
      }
      if (moved.count !== 1 && auditPrev.decision === "PROPOSED") {
        // propuesto sobre AVAILABLE: permitir si sigue AVAILABLE
        const still = await tx.clickatonPrizeBundle.findUnique({
          where: { id: bundle.id },
          select: { status: true },
        });
        if (still?.status !== "AVAILABLE") {
          throw new PartnersDomainError(
            "CONFLICT",
            "El premio cambió de estado; reintentá la cancelación.",
          );
        }
      }

      const current = await tx.clickatonPrizeAssignment.findUniqueOrThrow({
        where: { id: assignment.id },
        select: { auditJson: true },
      });
      const prev = readPrizeAssignmentAudit(current.auditJson);
      const winnerVersion = wasConfirmed ? prev.winnerVersion + 1 : prev.winnerVersion;
      const audit = appendPrizeAssignmentAudit(current.auditJson, {
        winnerVersion,
        decision: "CANCELLED",
        entry: {
          action: "CANCELLED",
          actorUserId: input.actorUserId ?? null,
          previousWinnerRegistrationId,
          winnerRegistrationId: null,
          note: input.note ?? null,
        },
      });

      await tx.clickatonPrizeAssignment.update({
        where: { id: assignment.id },
        data: {
          winnerRegistrationId: null,
          winnerEntryId: null,
          deliveredAt: null,
          replacedAt: previousWinnerRegistrationId ? new Date() : assignment.replacedAt,
          auditJson: audit.json,
        },
      });

      let outboxEventId: string | null = null;
      if (wasConfirmed && previousWinnerRegistrationId) {
        const outbox = await enqueueWinnerRevokedInTx(tx, {
          prizeAssignmentId: assignment.id,
          registrationId: previousWinnerRegistrationId,
          editionId: input.editionId,
          winnerVersion,
          previousWinnerRegistrationId,
          prizeBundleId: bundle.id,
          versionSuffix: "cancelled",
        });
        outboxEventId = outbox.eventId;
      }

      return {
        assignmentId: assignment.id,
        winnerVersion,
        outboxEventId,
      };
    });

    return { ok: true, ...result };
  } catch (e) {
    if (e instanceof PartnersDomainError) return err(e.code, e.message);
    throw e;
  }
}

/**
 * Marca entrega física. No emite eventos de elegibilidad.
 */
export async function markClickatonPrizeDelivered(input: {
  editionId: string;
  bundleId: string;
  actorUserId?: number | null;
  note?: string | null;
}): Promise<PrizeMutationResult<{ assignmentId: string; winnerVersion: number }>> {
  try {
    await requireEdition(input.editionId);
    const bundle = await loadBundleWithAssignment(input.bundleId);
    if (!bundle || bundle.editionId !== input.editionId) {
      return err("NOT_FOUND", "Premio no encontrado.");
    }
    const assignment = bundle.assignments[0] ?? null;
    if (!assignment) {
      return err("NOT_FOUND", "Asignación no encontrada.");
    }
    const auditPrev = readPrizeAssignmentAudit(assignment.auditJson);
    const view = stateView({
      bundleStatus: bundle.status,
      decision: auditPrev.decision,
      winnerRegistrationId: assignment.winnerRegistrationId,
      deliveredAt: assignment.deliveredAt,
      replacedAt: assignment.replacedAt,
    });
    if (!canDeliver(view)) {
      return err("INVALID_STATE", "No se puede marcar entregado en el estado actual.");
    }

    const result = await prisma.$transaction(async (tx) => {
      const moved = await tx.clickatonPrizeBundle.updateMany({
        where: { id: bundle.id, status: "ASSIGNED" },
        data: { status: "DELIVERED" },
      });
      if (moved.count !== 1) {
        throw new PartnersDomainError(
          "CONFLICT",
          "El premio cambió de estado; reintentá la entrega.",
        );
      }

      const current = await tx.clickatonPrizeAssignment.findUniqueOrThrow({
        where: { id: assignment.id },
        select: { auditJson: true },
      });
      const prev = readPrizeAssignmentAudit(current.auditJson);
      const audit = appendPrizeAssignmentAudit(current.auditJson, {
        winnerVersion: prev.winnerVersion,
        decision: "DELIVERED",
        entry: {
          action: "DELIVERED",
          actorUserId: input.actorUserId ?? null,
          winnerRegistrationId: assignment.winnerRegistrationId,
          note: input.note ?? null,
        },
      });

      await tx.clickatonPrizeAssignment.update({
        where: { id: assignment.id },
        data: {
          deliveredAt: new Date(),
          auditJson: audit.json,
        },
      });

      return {
        assignmentId: assignment.id,
        winnerVersion: prev.winnerVersion,
      };
    });

    return { ok: true, ...result };
  } catch (e) {
    if (e instanceof PartnersDomainError) return err(e.code, e.message);
    throw e;
  }
}
