/**
 * Outbox de emails transaccionales FotoRank (ETAPA 10C).
 * Idempotencia persistente por `idempotencyKey` única en DB.
 * No marcar SENT solo por audit event.
 */
import { prisma, Prisma } from "@repo/db";

export type TransactionalEmailKind =
  | "REGISTRATION_CONFIRMED"
  | "PHOTO_RECEIVED"
  | "PHOTO_REPLACEMENT_RECEIVED"
  | "ENTRY_CONFIRMED"
  | "REPLACEMENT_REQUESTED"
  | "JURY_INVITATION"
  | "JURY_INVITE_REMINDER"
  | "JURY_SCORING_OPEN"
  | "JURY_SCORING_CLOSING_SOON"
  | "JURY_ASSIGNMENT_NEW"
  | "JURY_SESSION_CLOSED";

export type OutboxDeliveryStatus =
  | "CREATED"
  | "QUEUED"
  | "PROCESSING"
  | "SENT"
  | "FAILED"
  | "RETRYABLE"
  | "DEAD";

export type OutboxMessage = {
  kind: TransactionalEmailKind;
  /** Clave canónica; si falta se deriva de kind+entryId+assetVersion. */
  idempotencyKey?: string;
  toUserId?: number;
  toEmail?: string;
  contestId?: string;
  entryId?: string;
  registrationId?: string;
  assetVersion?: number;
  payload: Record<string, unknown>;
  /** Forzar reintento aunque exista FAILED/RETRYABLE. */
  forceRetry?: boolean;
};

export type EnqueueResult = {
  queued: boolean;
  id: string;
  status: OutboxDeliveryStatus;
  deduplicated: boolean;
  providerMessageId?: string | null;
};

/** Clave canónica: KIND:entryId:assetVersion */
export function buildPhotoEmailIdempotencyKey(input: {
  kind: "PHOTO_RECEIVED" | "PHOTO_REPLACEMENT_RECEIVED";
  entryId: string;
  assetVersion: number;
}): string {
  const v = Math.max(1, Math.floor(input.assetVersion));
  return `${input.kind}:${input.entryId}:${v}`;
}

const memoryOutbox: Array<OutboxMessage & { id: string; createdAt: string; status: OutboxDeliveryStatus }> =
  [];

export function getMemoryOutboxSnapshot() {
  return [...memoryOutbox];
}

/** Solo tests/selfcheck: limpia el fallback en memoria. */
export function resetMemoryOutboxForTests() {
  memoryOutbox.length = 0;
}

function sanitizePayload(payload: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (v == null) continue;
    if (/argra|password|token|secret|gps|storagekey|latitude|longitude/i.test(k)) continue;
    out[k] = v;
  }
  return out;
}

async function writeAudit(input: {
  contestId?: string;
  entryId?: string;
  registrationId?: string;
  outboxId: string;
  kind: string;
  status: string;
  providerMessageId?: string | null;
  idempotencyKey: string;
}) {
  if (!input.contestId) return;
  try {
    const contest = await prisma.fotorankContest.findUnique({
      where: { id: input.contestId },
      select: { organizationId: true },
    });
    if (!contest?.organizationId) return;
    await prisma.fotorankJudgeAuditEvent.create({
      data: {
        organizationId: contest.organizationId,
        contestId: input.contestId,
        actorType: "SYSTEM",
        eventType: `EMAIL_${input.kind}`,
        entityType: input.entryId ? "FotorankContestEntry" : "EmailOutbox",
        entityId: input.entryId ?? input.registrationId ?? input.outboxId,
        payloadJson: {
          outboxId: input.outboxId,
          kind: input.kind,
          status: input.status,
          idempotencyKey: input.idempotencyKey,
          providerMessageId: input.providerMessageId ?? null,
        },
      },
    });
  } catch {
    // no bloquear
  }
}

async function deliverViaResend(input: {
  kind: TransactionalEmailKind;
  to: string;
  payload: Record<string, unknown>;
}): Promise<{ ok: boolean; providerMessageId?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY_ABSENT" };

  /* eslint-disable turbo/no-undeclared-env-vars -- from aliases used across apps */
  const from =
    process.env.EMAIL_FROM?.trim() ||
    process.env.RESEND_FROM?.trim() ||
    process.env.FOTORANK_EMAIL_FROM?.trim() ||
    "FotoRank <noreply@fotorank.com>";
  /* eslint-enable turbo/no-undeclared-env-vars */
  const tpl = TRANSACTIONAL_EMAIL_TEMPLATES[input.kind];
  let subject = tpl.subject;
  for (const [k, v] of Object.entries(input.payload)) {
    if (v == null) continue;
    subject = subject.split(`{{${k}}}`).join(String(v));
  }

  const bodyLines: string[] = [];
  if (input.kind === "PHOTO_RECEIVED") {
    bodyLines.push(String(input.payload.message ?? "Hemos recibido correctamente tu fotografía."));
    bodyLines.push("");
    bodyLines.push(`Concurso: ${String(input.payload.contestTitle ?? "Santa Fe en Foco")}`);
    if (input.payload.categoryName) bodyLines.push(`Categoría: ${String(input.payload.categoryName)}`);
    if (input.payload.entryNumber) bodyLines.push(`Número de obra: ${String(input.payload.entryNumber)}`);
    bodyLines.push(`Estado: ${String(input.payload.statusLabel ?? "En revisión")}`);
    if (input.payload.panelUrl) bodyLines.push(`Panel: ${String(input.payload.panelUrl)}`);
    if (input.payload.contact) bodyLines.push(`Contacto: ${String(input.payload.contact)}`);
    bodyLines.push("Conservá el archivo original hasta el cierre del concurso.");
  } else if (input.kind === "PHOTO_REPLACEMENT_RECEIVED") {
    bodyLines.push(
      String(input.payload.message ?? "Recibimos el reemplazo de tu fotografía. Volverá a revisión."),
    );
    bodyLines.push("");
    bodyLines.push(`Concurso: ${String(input.payload.contestTitle ?? "Santa Fe en Foco")}`);
    if (input.payload.entryNumber) bodyLines.push(`Número de obra: ${String(input.payload.entryNumber)}`);
    bodyLines.push("La versión anterior ya no compite.");
    if (input.payload.panelUrl) bodyLines.push(`Panel: ${String(input.payload.panelUrl)}`);
  } else {
    bodyLines.push(`Evento: ${input.kind}`);
    for (const [k, v] of Object.entries(input.payload)) {
      if (v == null) continue;
      bodyLines.push(`${k}: ${String(v)}`);
    }
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject,
        text: bodyLines.join("\n"),
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) {
      return { ok: false, error: json.message ?? `HTTP_${res.status}` };
    }
    return { ok: true, providerMessageId: json.id ?? undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function enqueueTransactionalEmail(msg: OutboxMessage): Promise<EnqueueResult> {
  const assetVersion =
    typeof msg.assetVersion === "number" && Number.isFinite(msg.assetVersion)
      ? Math.max(1, Math.floor(msg.assetVersion))
      : typeof msg.payload.assetVersion === "number"
        ? Math.max(1, Math.floor(msg.payload.assetVersion as number))
        : 1;

  let idempotencyKey = msg.idempotencyKey?.trim() || "";
  if (!idempotencyKey) {
    if (
      (msg.kind === "PHOTO_RECEIVED" || msg.kind === "PHOTO_REPLACEMENT_RECEIVED") &&
      msg.entryId
    ) {
      idempotencyKey = buildPhotoEmailIdempotencyKey({
        kind: msg.kind,
        entryId: msg.entryId,
        assetVersion,
      });
    } else {
      idempotencyKey = `${msg.kind}:${msg.entryId ?? msg.registrationId ?? "na"}:${assetVersion}`;
    }
  }

  const payload = sanitizePayload({
    ...msg.payload,
    assetVersion,
  });

  // Memoria (tests locales sin DB)
  const memHit = memoryOutbox.find((r) => (r as { idempotencyKey?: string }).idempotencyKey === idempotencyKey);
  if (memHit && !msg.forceRetry) {
    return {
      queued: true,
      id: memHit.id,
      status: memHit.status,
      deduplicated: true,
      providerMessageId: null,
    };
  }

  // 1) Intentar crear fila (única por key)
  let row:
    | {
        id: string;
        status: string;
        providerMessageId: string | null;
        attemptCount: number;
      }
    | null = null;
  let deduplicated = false;

  try {
    row = await prisma.fotorankTransactionalEmailOutbox.create({
      data: {
        idempotencyKey,
        kind: msg.kind,
        status: "CREATED",
        contestId: msg.contestId ?? null,
        entryId: msg.entryId ?? null,
        registrationId: msg.registrationId ?? null,
        toUserId: msg.toUserId ?? null,
        payloadJson: payload as Prisma.InputJsonValue,
        queuedAt: new Date(),
      },
      select: { id: true, status: true, providerMessageId: true, attemptCount: true },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const existing = await prisma.fotorankTransactionalEmailOutbox.findUnique({
        where: { idempotencyKey },
        select: {
          id: true,
          status: true,
          providerMessageId: true,
          attemptCount: true,
        },
      });
      if (!existing) {
        return { queued: false, id: "unknown", status: "FAILED", deduplicated: true };
      }
      // Ya enviado o en vuelo → no duplicar entrega
      if (existing.status === "SENT") {
        return {
          queued: true,
          id: existing.id,
          status: "SENT",
          deduplicated: true,
          providerMessageId: existing.providerMessageId,
        };
      }
      if (
        existing.status === "QUEUED" ||
        existing.status === "PROCESSING" ||
        existing.status === "CREATED"
      ) {
        return {
          queued: true,
          id: existing.id,
          status: existing.status as OutboxDeliveryStatus,
          deduplicated: true,
          providerMessageId: existing.providerMessageId,
        };
      }
      if (existing.status === "DEAD" && !msg.forceRetry) {
        return {
          queued: true,
          id: existing.id,
          status: "DEAD",
          deduplicated: true,
          providerMessageId: existing.providerMessageId,
        };
      }
      // RETRYABLE / FAILED: reintentar entrega sobre la misma fila (sin nuevo intent)
      row = existing;
      deduplicated = true;
    } else {
      // Fallback memoria si tabla no migrada aún (dedupe atómica ante concurrencia)
      const raced = memoryOutbox.find(
        (r) => (r as { idempotencyKey?: string }).idempotencyKey === idempotencyKey,
      );
      if (raced) {
        return {
          queued: true,
          id: raced.id,
          status: raced.status,
          deduplicated: true,
          providerMessageId: null,
        };
      }
      const id = `mail_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      const memRow = {
        ...msg,
        idempotencyKey,
        id,
        createdAt: new Date().toISOString(),
        status: "QUEUED" as OutboxDeliveryStatus,
      };
      memoryOutbox.push(memRow);
      // Segunda pasada por carrera: conservar el primero
      const sameKey = memoryOutbox.filter(
        (r) => (r as { idempotencyKey?: string }).idempotencyKey === idempotencyKey,
      );
      if (sameKey.length > 1) {
        const keep = sameKey[0]!;
        for (let i = memoryOutbox.length - 1; i >= 0; i--) {
          const row = memoryOutbox[i]!;
          if (
            (row as { idempotencyKey?: string }).idempotencyKey === idempotencyKey &&
            row.id !== keep.id
          ) {
            memoryOutbox.splice(i, 1);
          }
        }
        return {
          queued: true,
          id: keep.id,
          status: keep.status,
          deduplicated: keep.id !== id,
          providerMessageId: null,
        };
      }
      return { queued: true, id, status: "QUEUED", deduplicated: false };
    }
  }

  if (!row) {
    return { queued: false, id: "none", status: "FAILED", deduplicated };
  }

  await prisma.fotorankTransactionalEmailOutbox.update({
    where: { id: row.id },
    data: {
      status: "PROCESSING",
      attemptCount: { increment: 1 },
      queuedAt: new Date(),
    },
  });

  await writeAudit({
    contestId: msg.contestId,
    entryId: msg.entryId,
    registrationId: msg.registrationId,
    outboxId: row.id,
    kind: msg.kind,
    status: "PROCESSING",
    idempotencyKey,
  });

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey && !process.env.FOTORANK_SMTP_URL) {
    await prisma.fotorankTransactionalEmailOutbox.update({
      where: { id: row.id },
      data: { status: "QUEUED", lastError: "PROVIDER_ABSENT" },
    });
    return { queued: true, id: row.id, status: "QUEUED", deduplicated };
  }

  const to =
    msg.toEmail?.trim() ||
    (msg.toUserId
      ? (
          await prisma.user.findUnique({
            where: { id: msg.toUserId },
            select: { email: true },
          })
        )?.email
      : null);

  if (!to) {
    await prisma.fotorankTransactionalEmailOutbox.update({
      where: { id: row.id },
      data: { status: "FAILED", failedAt: new Date(), lastError: "NO_RECIPIENT" },
    });
    return { queued: true, id: row.id, status: "FAILED", deduplicated };
  }

  const delivered = await deliverViaResend({ kind: msg.kind, to, payload });
  if (!delivered.ok) {
    await prisma.fotorankTransactionalEmailOutbox.update({
      where: { id: row.id },
      data: {
        status: "RETRYABLE",
        failedAt: new Date(),
        lastError: delivered.error?.slice(0, 500) ?? "SEND_FAILED",
        provider: "resend",
      },
    });
    await writeAudit({
      contestId: msg.contestId,
      entryId: msg.entryId,
      registrationId: msg.registrationId,
      outboxId: row.id,
      kind: msg.kind,
      status: "RETRYABLE",
      idempotencyKey,
    });
    return { queued: true, id: row.id, status: "RETRYABLE", deduplicated };
  }

  await prisma.fotorankTransactionalEmailOutbox.update({
    where: { id: row.id },
    data: {
      status: "SENT",
      sentAt: new Date(),
      provider: "resend",
      providerMessageId: delivered.providerMessageId ?? null,
      lastError: null,
    },
  });
  await writeAudit({
    contestId: msg.contestId,
    entryId: msg.entryId,
    registrationId: msg.registrationId,
    outboxId: row.id,
    kind: msg.kind,
    status: "SENT",
    providerMessageId: delivered.providerMessageId,
    idempotencyKey,
  });

  return {
    queued: true,
    id: row.id,
    status: "SENT",
    deduplicated,
    providerMessageId: delivered.providerMessageId ?? null,
  };
}

export const TRANSACTIONAL_EMAIL_TEMPLATES: Record<
  TransactionalEmailKind,
  { subject: string; requiredVars: string[] }
> = {
  REGISTRATION_CONFIRMED: {
    subject: "Inscripción confirmada — {{contestTitle}}",
    requiredVars: ["contestTitle", "registrationNumber"],
  },
  PHOTO_RECEIVED: {
    subject: "Hemos recibido correctamente tu fotografía — {{contestTitle}}",
    requiredVars: ["contestTitle"],
  },
  PHOTO_REPLACEMENT_RECEIVED: {
    subject: "Reemplazo de fotografía recibido — {{contestTitle}}",
    requiredVars: ["contestTitle"],
  },
  ENTRY_CONFIRMED: {
    subject: "Obra confirmada — {{anonymousCode}}",
    requiredVars: ["contestTitle", "anonymousCode"],
  },
  REPLACEMENT_REQUESTED: {
    subject: "Solicitud de reemplazo — {{contestTitle}}",
    requiredVars: ["contestTitle", "reason"],
  },
  JURY_INVITATION: {
    subject: "Invitación a jurado — {{contestTitle}}",
    requiredVars: ["contestTitle", "inviteUrl"],
  },
  JURY_INVITE_REMINDER: {
    subject: "Recordatorio: invitación a jurado — {{contestTitle}}",
    requiredVars: ["contestTitle"],
  },
  JURY_SCORING_OPEN: {
    subject: "Evaluación abierta — {{contestTitle}}",
    requiredVars: ["contestTitle"],
  },
  JURY_SCORING_CLOSING_SOON: {
    subject: "Cierre próximo de evaluación — {{contestTitle}}",
    requiredVars: ["contestTitle"],
  },
  JURY_ASSIGNMENT_NEW: {
    subject: "Nueva asignación de jurado — {{contestTitle}}",
    requiredVars: ["contestTitle"],
  },
  JURY_SESSION_CLOSED: {
    subject: "Sesión de evaluación cerrada — {{contestTitle}}",
    requiredVars: ["contestTitle"],
  },
};
