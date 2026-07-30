import { prisma } from "@repo/db";
import { linkRegistrationIdentity } from "@/lib/registration/application/link-registration-identity";
import { issueRegistrationQrToken } from "@/lib/registration/security/qr-token";
import { sendParticipantFunnelEmail } from "@/lib/registration/notifications/participant-email";
import { signRegistrationAccessToken } from "@/lib/public-registration/domain/access-token";

function formatVisibleCode(prefix: string, seq: number, width = 5): string {
  const safe = prefix.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 8) || "CK";
  return `${safe}-${String(seq).padStart(width, "0")}`;
}

/**
 * Confirm a free (totalAmount=0) registration: CONFIRMED + credential + regenerable QR.
 * Idempotent. No Mercado Pago.
 */
export async function confirmFreeRegistration(input: {
  registrationId: string;
  editionSlug: string;
  editionPrefix?: string;
  source?: string;
}): Promise<{
  status: "CONFIRMED";
  publicCode: string;
  credentialId: string;
  alreadyConfirmed: boolean;
}> {
  const source = input.source ?? "free_ticket_auto_confirm";

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.clickatonRegistration.findUnique({
      where: { id: input.registrationId },
      include: { edition: true },
    });
    if (!existing) {
      throw new Error("REGISTRATION_NOT_FOUND");
    }
    if (existing.totalAmount !== 0) {
      throw new Error("NOT_FREE_TICKET");
    }
    if (existing.status === "CONFIRMED") {
      const cred = await tx.clickatonParticipantCredential.findUnique({
        where: { registrationId: existing.id },
      });
      return {
        status: "CONFIRMED" as const,
        publicCode: cred?.publicCode ?? existing.visibleCode ?? existing.id.slice(0, 8),
        credentialId: cred?.id ?? "",
        alreadyConfirmed: true,
        editionName: existing.edition.name,
        email: existing.email,
        firstName: existing.firstName,
        lastName: existing.lastName,
        city: existing.city,
        startAt: existing.edition.startAt,
      };
    }

    const prefix =
      input.editionPrefix ||
      existing.edition.visibleCodePrefix ||
      "CK";
    let visibleCode = existing.visibleCode;
    let sequenceNumber = existing.sequenceNumber;
    if (!visibleCode) {
      const seq = await tx.clickatonEditionSequence.upsert({
        where: { editionId: existing.editionId },
        create: { editionId: existing.editionId, lastValue: 1 },
        update: { lastValue: { increment: 1 } },
      });
      sequenceNumber = seq.lastValue;
      visibleCode = formatVisibleCode(prefix, sequenceNumber);
    }

    await tx.clickatonRegistration.update({
      where: { id: existing.id },
      data: {
        status: "CONFIRMED",
        paymentStatus: "NOT_REQUIRED",
        confirmedAt: new Date(),
        visibleCode,
        sequenceNumber,
        holdExpiresAt: null,
      },
    });

    await tx.clickatonCapacityHold.updateMany({
      where: { registrationId: existing.id, status: "ACTIVE" },
      data: { status: "CONSUMED", consumedAt: new Date() },
    });
    await tx.clickatonStockHold.updateMany({
      where: { registrationId: existing.id, status: "ACTIVE" },
      data: { status: "CONSUMED", consumedAt: new Date() },
    });

    await tx.clickatonRegistrationStatusHistory.create({
      data: {
        registrationId: existing.id,
        previousStatus: existing.status,
        newStatus: "CONFIRMED",
        previousPaymentStatus: existing.paymentStatus,
        newPaymentStatus: "NOT_REQUIRED",
        source,
        reason: "free_ticket_auto_confirm",
      },
    });

    let credential = await tx.clickatonParticipantCredential.findUnique({
      where: { registrationId: existing.id },
    });
    if (!credential) {
      credential = await tx.clickatonParticipantCredential.create({
        data: {
          registrationId: existing.id,
          status: "ACTIVE",
          publicCode: visibleCode,
        },
      });
      await tx.clickatonRegistrationAudit.create({
        data: {
          registrationId: existing.id,
          action: "CREDENTIAL_ISSUED",
          source,
          metadata: { publicCodePrefix: visibleCode.slice(0, 8), free: true },
        },
      });
    }

    const activeQr = await tx.clickatonQrToken.findFirst({
      where: { credentialId: credential.id, status: "ACTIVE", revokedAt: null },
    });
    if (!activeQr) {
      const issued = issueRegistrationQrToken({
        registrationId: existing.id,
        credentialId: credential.id,
      });
      await tx.clickatonQrToken.create({
        data: {
          credentialId: credential.id,
          tokenHash: issued.tokenHash,
          tokenPrefix: issued.tokenPrefix,
          status: "ACTIVE",
        },
      });
      await tx.clickatonRegistrationAudit.create({
        data: {
          registrationId: existing.id,
          action: "QR_TOKEN_ISSUED",
          source,
          metadata: { tokenPrefix: issued.tokenPrefix, regenerable: true, free: true },
        },
      });
    }

    return {
      status: "CONFIRMED" as const,
      publicCode: credential.publicCode,
      credentialId: credential.id,
      alreadyConfirmed: false,
      editionName: existing.edition.name,
      email: existing.email,
      firstName: existing.firstName,
      lastName: existing.lastName,
      city: existing.city,
      startAt: existing.edition.startAt,
    };
  });

  try {
    await linkRegistrationIdentity({
      registrationId: input.registrationId,
      email: result.email,
      name: `${result.firstName} ${result.lastName}`.trim(),
      sourceApplication: "clickaton",
    });
  } catch {
    // best-effort: free confirm no revierte por identidad
  }

  if (!result.alreadyConfirmed) {
    const accessToken = signRegistrationAccessToken({
      registrationId: input.registrationId,
      editionSlug: input.editionSlug,
      expiresAtMs: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });
    const emailResult = await sendParticipantFunnelEmail({
      kind: "free_confirmed",
      to: result.email,
      participantName: result.firstName,
      editionName: result.editionName,
      editionSlug: input.editionSlug,
      registrationId: input.registrationId,
      accessToken,
      city: result.city,
      startAt: result.startAt,
    });
    await prisma.clickatonRegistrationAudit.create({
      data: {
        registrationId: input.registrationId,
        action: emailResult.sent ? "EMAIL_SENT" : "EMAIL_QUEUED",
        source: "free_ticket_auto_confirm",
        metadata: {
          kind: "free_confirmed",
          skipped: emailResult.skipped,
          reason: emailResult.reason?.slice(0, 120),
          messageIdPrefix: emailResult.messageId?.slice(0, 8),
        },
      },
    });
  }

  return {
    status: result.status,
    publicCode: result.publicCode,
    credentialId: result.credentialId,
    alreadyConfirmed: result.alreadyConfirmed,
  };
}

/** Resolve regenerable QR plaintext for an authorized participant view. */
export async function resolveActiveQrPlaintext(input: {
  registrationId: string;
}): Promise<{ plaintext: string; publicCode: string } | null> {
  const cred = await prisma.clickatonParticipantCredential.findUnique({
    where: { registrationId: input.registrationId },
    include: {
      qrTokens: {
        where: { status: "ACTIVE", revokedAt: null },
        orderBy: { issuedAt: "desc" },
        take: 1,
      },
      registration: { select: { status: true } },
    },
  });
  if (!cred || cred.registration.status !== "CONFIRMED") return null;
  const active = cred.qrTokens[0];
  if (!active) return null;
  const issued = issueRegistrationQrToken({
    registrationId: input.registrationId,
    credentialId: cred.id,
  });
  if (issued.tokenHash !== active.tokenHash) {
    // Legacy random token: re-issue regenerable replacement
    await prisma.$transaction(async (tx) => {
      await tx.clickatonQrToken.update({
        where: { id: active.id },
        data: { status: "REVOKED", revokedAt: new Date() },
      });
      await tx.clickatonQrToken.create({
        data: {
          credentialId: cred.id,
          tokenHash: issued.tokenHash,
          tokenPrefix: issued.tokenPrefix,
          status: "ACTIVE",
        },
      });
    });
  }
  return { plaintext: issued.plaintext, publicCode: cred.publicCode };
}
