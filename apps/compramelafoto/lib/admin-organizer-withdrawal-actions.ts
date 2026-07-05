import {
  EventOrganizerCommissionStatus,
  OrganizerCommissionWithdrawalStatus,
  Prisma,
} from "@/lib/prisma";

export class WithdrawalActionError extends Error {
  constructor(
    public readonly code: string,
    message?: string
  ) {
    super(message ?? code);
    this.name = "WithdrawalActionError";
  }
}

type Db = Prisma.TransactionClient;

function assertTerminalNotPaid(row: {
  status: OrganizerCommissionWithdrawalStatus;
}): void {
  if (
    row.status === OrganizerCommissionWithdrawalStatus.PAID ||
    row.status === OrganizerCommissionWithdrawalStatus.REJECTED ||
    row.status === OrganizerCommissionWithdrawalStatus.CANCELLED
  ) {
    throw new WithdrawalActionError(
      "INVALID_STATUS",
      "La solicitud ya está cerrada (pagada, rechazada o cancelada)."
    );
  }
}

/**
 * Aprobar: solo REQUESTED → APPROVED. No modifica comisiones.
 */
export async function approveWithdrawalInTx(
  db: Db,
  params: { withdrawalId: number; adminUserId: number; adminNotes?: string | null }
): Promise<void> {
  const now = new Date();
  const row = await db.organizerCommissionWithdrawalRequest.findUnique({
    where: { id: params.withdrawalId },
  });
  if (!row) throw new WithdrawalActionError("NOT_FOUND", "Solicitud no encontrada");
  if (row.status !== OrganizerCommissionWithdrawalStatus.REQUESTED) {
    throw new WithdrawalActionError(
      "INVALID_STATUS",
      "Solo se pueden aprobar solicitudes en estado Solicitado."
    );
  }

  const notesTrim = params.adminNotes != null ? String(params.adminNotes).trim() : "";

  await db.organizerCommissionWithdrawalRequest.update({
    where: { id: params.withdrawalId },
    data: {
      status: OrganizerCommissionWithdrawalStatus.APPROVED,
      reviewedAt: now,
      reviewedBy: { connect: { id: params.adminUserId } },
      ...(notesTrim !== ""
        ? {
            adminNotes: row.adminNotes
              ? `${row.adminNotes}\n---\n${notesTrim}`
              : notesTrim,
          }
        : {}),
    },
  });
}

async function revertCommissionsToAvailable(db: Db, withdrawalId: number): Promise<void> {
  await db.eventOrganizerCommission.updateMany({
    where: {
      withdrawalRequestId: withdrawalId,
      status: EventOrganizerCommissionStatus.WITHDRAWAL_REQUESTED,
    },
    data: {
      status: EventOrganizerCommissionStatus.AVAILABLE,
      withdrawalRequestId: null,
    },
  });
}

/**
 * Rechazar: REQUESTED o APPROVED. Notas obligatorias. Comisiones WR → AVAILABLE y sin withdrawalRequestId.
 */
export async function rejectWithdrawalInTx(
  db: Db,
  params: { withdrawalId: number; adminUserId: number; adminNotes: string | null | undefined }
): Promise<void> {
  const now = new Date();
  const row = await db.organizerCommissionWithdrawalRequest.findUnique({
    where: { id: params.withdrawalId },
  });
  if (!row) throw new WithdrawalActionError("NOT_FOUND", "Solicitud no encontrada");
  assertTerminalNotPaid(row);

  if (
    row.status !== OrganizerCommissionWithdrawalStatus.REQUESTED &&
    row.status !== OrganizerCommissionWithdrawalStatus.APPROVED
  ) {
    throw new WithdrawalActionError("INVALID_STATUS", "No se puede rechazar esta solicitud.");
  }

  const notesTrim = params.adminNotes != null ? String(params.adminNotes).trim() : "";
  if (notesTrim.length < 3) {
    throw new WithdrawalActionError(
      "NOTES_REQUIRED",
      "Las notas del administrador son obligatorias al rechazar (mín. 3 caracteres)."
    );
  }

  await db.organizerCommissionWithdrawalRequest.update({
    where: { id: params.withdrawalId },
    data: {
      status: OrganizerCommissionWithdrawalStatus.REJECTED,
      reviewedAt: now,
      reviewedBy: { connect: { id: params.adminUserId } },
      adminNotes: notesTrim,
    },
  });

  await revertCommissionsToAvailable(db, params.withdrawalId);
}

/**
 * Marcar pagado: REQUESTED o APPROVED → PAID. Referencia recomendada obligatoria en API.
 * Comisiones WR → PAID y paidAt = now. No toca comisiones CANCELLED (no suelen tener WR).
 */
export async function markPaidWithdrawalInTx(
  db: Db,
  params: {
    withdrawalId: number;
    adminUserId: number;
    paymentReference: string | null | undefined;
    adminNotes?: string | null;
  }
): Promise<void> {
  const now = new Date();
  const row = await db.organizerCommissionWithdrawalRequest.findUnique({
    where: { id: params.withdrawalId },
  });
  if (!row) throw new WithdrawalActionError("NOT_FOUND", "Solicitud no encontrada");
  assertTerminalNotPaid(row);

  if (
    row.status !== OrganizerCommissionWithdrawalStatus.REQUESTED &&
    row.status !== OrganizerCommissionWithdrawalStatus.APPROVED
  ) {
    throw new WithdrawalActionError("INVALID_STATUS", "No se puede marcar como pagada esta solicitud.");
  }

  const refTrim =
    params.paymentReference != null ? String(params.paymentReference).trim() : "";
  if (refTrim.length < 2) {
    throw new WithdrawalActionError(
      "REFERENCE_REQUIRED",
      "La referencia de pago es obligatoria (transferencia, cupón, etc.)."
    );
  }

  const notesTrim =
    params.adminNotes != null ? String(params.adminNotes).trim() : "";

  const updateData: Prisma.OrganizerCommissionWithdrawalRequestUpdateInput = {
    status: OrganizerCommissionWithdrawalStatus.PAID,
    reviewedAt: row.reviewedAt ?? now,
    reviewedBy: { connect: { id: params.adminUserId } },
    paymentReference: refTrim,
  };
  if (notesTrim !== "") {
    updateData.adminNotes = row.adminNotes
      ? `${row.adminNotes}\n---\n${notesTrim}`
      : notesTrim;
  }

  await db.organizerCommissionWithdrawalRequest.update({
    where: { id: params.withdrawalId },
    data: updateData,
  });

  await db.eventOrganizerCommission.updateMany({
    where: {
      withdrawalRequestId: params.withdrawalId,
      status: EventOrganizerCommissionStatus.WITHDRAWAL_REQUESTED,
    },
    data: {
      status: EventOrganizerCommissionStatus.PAID,
      paidAt: now,
    },
  });
}

/**
 * Cancelar (admin): REQUESTED o APPROVED → CANCELLED. Comisiones vuelven a AVAILABLE.
 */
export async function cancelWithdrawalInTx(
  db: Db,
  params: { withdrawalId: number; adminUserId: number; adminNotes?: string | null }
): Promise<void> {
  const now = new Date();
  const row = await db.organizerCommissionWithdrawalRequest.findUnique({
    where: { id: params.withdrawalId },
  });
  if (!row) throw new WithdrawalActionError("NOT_FOUND", "Solicitud no encontrada");
  assertTerminalNotPaid(row);

  if (
    row.status !== OrganizerCommissionWithdrawalStatus.REQUESTED &&
    row.status !== OrganizerCommissionWithdrawalStatus.APPROVED
  ) {
    throw new WithdrawalActionError("INVALID_STATUS", "No se puede cancelar esta solicitud.");
  }

  const notesTrim = params.adminNotes != null ? String(params.adminNotes).trim() : "";

  await db.organizerCommissionWithdrawalRequest.update({
    where: { id: params.withdrawalId },
    data: {
      status: OrganizerCommissionWithdrawalStatus.CANCELLED,
      reviewedAt: now,
      reviewedBy: { connect: { id: params.adminUserId } },
      ...(notesTrim !== ""
        ? {
            adminNotes: row.adminNotes
              ? `${row.adminNotes}\n---\n${notesTrim}`
              : notesTrim,
          }
        : {}),
    },
  });

  await revertCommissionsToAvailable(db, params.withdrawalId);
}
