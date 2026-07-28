/**
 * Durable idempotent email delivery for Clickatón funnel mails.
 * Uses EmailQueue.idempotencyKey (unique) so webhook/S2S/retry cannot double-send.
 */
import { prisma } from "@repo/db";
import { sendIdentityEmail } from "@repo/auth";

export const PAYMENT_CONFIRMATION_TEMPLATE_KEY = "CLICKATON_PAYMENT_CONFIRMATION";
export const PAYMENT_CONFIRMATION_TEMPLATE_VERSION = "v1";

export function paymentConfirmationIdempotencyKey(registrationId: string): string {
  return `${registrationId}:${PAYMENT_CONFIRMATION_TEMPLATE_KEY}:${PAYMENT_CONFIRMATION_TEMPLATE_VERSION}`;
}

export type EnqueueEmailInput = {
  idempotencyKey: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  templateKey: string;
  templateData?: Record<string, unknown>;
};

export type EmailDeliveryOutcome = {
  status: "ALREADY_SENT" | "SENT" | "QUEUED" | "FAILED" | "SKIPPED";
  emailQueueId: number | null;
  providerMessageId?: string;
  reason?: string;
};

/**
 * Create-or-get EmailQueue row, then attempt provider send once if not SENT.
 * Payment path must not await forever — caller should catch.
 */
export async function enqueueAndSendIdempotentEmail(
  input: EnqueueEmailInput,
): Promise<EmailDeliveryOutcome> {
  const existing = await prisma.emailQueue.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });

  if (existing?.status === "SENT") {
    return {
      status: "ALREADY_SENT",
      emailQueueId: existing.id,
      providerMessageId:
        typeof existing.templateData === "object" &&
        existing.templateData &&
        "providerMessageId" in existing.templateData
          ? String(
              (existing.templateData as { providerMessageId?: string }).providerMessageId ??
                "",
            ) || undefined
          : undefined,
    };
  }

  const row =
    existing ??
    (await prisma.emailQueue.create({
      data: {
        to: input.to,
        subject: input.subject,
        body: input.text,
        htmlBody: input.html,
        status: "PENDING",
        attempts: 0,
        maxAttempts: 5,
        idempotencyKey: input.idempotencyKey,
        templateData: {
          templateKey: input.templateKey,
          ...(input.templateData ?? {}),
        },
      },
    }));

  if (row.attempts >= row.maxAttempts && row.status === "FAILED") {
    return {
      status: "FAILED",
      emailQueueId: row.id,
      reason: row.errorMessage ?? "max_attempts",
    };
  }

  await prisma.emailQueue.update({
    where: { id: row.id },
    data: {
      status: "PROCESSING",
      attempts: { increment: 1 },
      lastAttemptAt: new Date(),
      subject: input.subject,
      body: input.text,
      htmlBody: input.html,
      to: input.to,
    },
  });

  const result = await sendIdentityEmail({
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
    templateKey: input.templateKey,
  });

  if (result.sent) {
    await prisma.emailQueue.update({
      where: { id: row.id },
      data: {
        status: "SENT",
        sentAt: new Date(),
        errorMessage: null,
        templateData: {
          templateKey: input.templateKey,
          providerMessageId: result.messageId ?? null,
          provider: "resend",
          ...(input.templateData ?? {}),
        },
      },
    });
    return {
      status: "SENT",
      emailQueueId: row.id,
      providerMessageId: result.messageId,
    };
  }

  if (result.skipped) {
    await prisma.emailQueue.update({
      where: { id: row.id },
      data: {
        status: "PENDING",
        errorMessage: result.reason?.slice(0, 500) ?? "skipped",
      },
    });
    return {
      status: "SKIPPED",
      emailQueueId: row.id,
      reason: result.reason,
    };
  }

  await prisma.emailQueue.update({
    where: { id: row.id },
    data: {
      status: "FAILED",
      errorMessage: result.reason?.slice(0, 500) ?? "send_failed",
    },
  });
  return {
    status: "FAILED",
    emailQueueId: row.id,
    reason: result.reason,
  };
}

export async function getEmailDeliveryDiagnostics(limit = 20): Promise<{
  pending: number;
  sent: number;
  failed: number;
  recent: Array<{
    id: number;
    status: string;
    toMasked: string;
    attempts: number;
    lastError: string | null;
    sentAt: string | null;
  }>;
}> {
  const clickatonKey = { contains: "CLICKATON_" } as const;
  const [pending, sent, failed, recent] = await Promise.all([
    prisma.emailQueue.count({
      where: {
        idempotencyKey: clickatonKey,
        status: { in: ["PENDING", "PROCESSING"] },
      },
    }),
    prisma.emailQueue.count({
      where: { status: "SENT", idempotencyKey: clickatonKey },
    }),
    prisma.emailQueue.count({
      where: { status: "FAILED", idempotencyKey: clickatonKey },
    }),
    prisma.emailQueue.findMany({
      where: { idempotencyKey: clickatonKey },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        status: true,
        to: true,
        attempts: true,
        errorMessage: true,
        sentAt: true,
      },
    }),
  ]);

  return {
    pending,
    sent,
    failed,
    recent: recent.map((r) => ({
      id: r.id,
      status: r.status,
      toMasked: maskEmail(r.to),
      attempts: r.attempts,
      lastError: r.errorMessage,
      sentAt: r.sentAt?.toISOString() ?? null,
    })),
  };
}

function maskEmail(email: string): string {
  const [u, d] = email.split("@");
  if (!u || !d) return "***";
  return `${u.slice(0, 1)}***@${d[0] ?? "*"}***`;
}
