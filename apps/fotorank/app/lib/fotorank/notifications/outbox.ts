/**
 * Outbox de emails transaccionales.
 * Con RESEND_API_KEY: envía vía Resend API (fetch). Sin key: queda QUEUED (no afirmar envío en UI).
 * La inscripción NO debe fallar si el email falla.
 */
import { prisma } from "@repo/db";

export type TransactionalEmailKind =
  | "REGISTRATION_CONFIRMED"
  | "PHOTO_RECEIVED"
  | "ENTRY_CONFIRMED"
  | "REPLACEMENT_REQUESTED"
  | "JURY_INVITATION"
  | "JURY_INVITE_REMINDER"
  | "JURY_SCORING_OPEN"
  | "JURY_SCORING_CLOSING_SOON"
  | "JURY_ASSIGNMENT_NEW"
  | "JURY_SESSION_CLOSED";

export type OutboxMessage = {
  kind: TransactionalEmailKind;
  toUserId?: number;
  toEmail?: string;
  contestId?: string;
  entryId?: string;
  registrationId?: string;
  payload: Record<string, unknown>;
};

type OutboxStatus = "QUEUED" | "FAILED" | "SENT";

const memoryOutbox: Array<OutboxMessage & { id: string; createdAt: string; status: OutboxStatus }> = [];

export function getMemoryOutboxSnapshot() {
  return [...memoryOutbox];
}

function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function buildRegistrationConfirmedEmail(payload: Record<string, unknown>): {
  subject: string;
  html: string;
  text: string;
} {
  const contestTitle = str(payload.contestTitle) || "Santa Fe en Foco";
  const categoryName = str(payload.categoryName) || "—";
  const registrationNumber = str(payload.registrationNumber) || "—";
  const status = str(payload.status) || "CONFIRMED";
  const contestSlug = str(payload.contestSlug) || "santa-fe-en-foco";
  const contact = str(payload.contactEmail) || "sfprosario@gmail.com";
  const baseUrl = (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "https://fotorank.com"
  ).replace(/\/$/, "");
  const panelLink = `${baseUrl}/participaciones`;
  const basesLink = `${baseUrl}/concursos/${contestSlug}#bases`;
  const privacyLink = `${baseUrl}/concursos/${contestSlug}#bases`;

  const subject = `Inscripción confirmada — ${contestTitle}`;
  const text = [
    `Tu inscripción a ${contestTitle} fue confirmada.`,
    `Categoría: ${categoryName}`,
    `Número de inscripción: ${registrationNumber}`,
    `Estado: ${status}`,
    "",
    "La carga de fotografías se habilitará próximamente y se comunicará por los canales oficiales del concurso.",
    "Período de captura: 1 de agosto al 30 de septiembre de 2026.",
    `Contacto: ${contact}`,
    `Mis participaciones: ${panelLink}`,
    `Bases: ${basesLink}`,
    `Privacidad / bases: ${privacyLink}`,
  ].join("\n");

  const html = `
    <p>Tu inscripción a <strong>${escapeHtml(contestTitle)}</strong> fue confirmada.</p>
    <ul>
      <li><strong>Categoría:</strong> ${escapeHtml(categoryName)}</li>
      <li><strong>Número de inscripción:</strong> ${escapeHtml(registrationNumber)}</li>
      <li><strong>Estado:</strong> ${escapeHtml(status)}</li>
    </ul>
    <p>La inscripción ya está abierta. La carga de fotografías se habilitará próximamente y se comunicará por los canales oficiales del concurso.</p>
    <p>Período de captura de fotografías: 1 de agosto al 30 de septiembre de 2026.</p>
    <p>Contacto: <a href="mailto:${escapeHtml(contact)}">${escapeHtml(contact)}</a></p>
    <p><a href="${escapeHtml(panelLink)}">Ir a mis participaciones</a></p>
    <p><a href="${escapeHtml(basesLink)}">Bases</a> · <a href="${escapeHtml(privacyLink)}">Privacidad</a></p>
  `;

  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function resolveRecipientEmail(msg: OutboxMessage): Promise<string | null> {
  if (msg.toEmail?.trim()) return msg.toEmail.trim();
  if (!msg.toUserId) return null;
  const user = await prisma.user.findUnique({
    where: { id: msg.toUserId },
    select: { email: true },
  });
  return user?.email ?? null;
}

async function sendViaResend(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  idempotencyKey: string;
}): Promise<{ ok: true; providerId: string | null } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY missing" };

  const from =
    process.env.RESEND_FROM?.trim() ||
    process.env.FOTORANK_EMAIL_FROM?.trim() ||
    "";
  if (!from) return { ok: false, error: "RESEND_FROM / FOTORANK_EMAIL_FROM missing" };

  const body: Record<string, unknown> = {
    from,
    to: [input.to],
    subject: input.subject,
    html: input.html,
    text: input.text,
  };
  if (input.replyTo) body.reply_to = input.replyTo;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": input.idempotencyKey.slice(0, 256),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    // Never log API key; truncate body.
    return { ok: false, error: `Resend HTTP ${res.status}: ${errText.slice(0, 200)}` };
  }
  const json = (await res.json().catch(() => null)) as { id?: string } | null;
  return { ok: true, providerId: json?.id ?? null };
}

export async function enqueueTransactionalEmail(msg: OutboxMessage): Promise<{
  queued: boolean;
  id: string;
  sent: boolean;
}> {
  const id = `mail_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const row = {
    ...msg,
    id,
    createdAt: new Date().toISOString(),
    status: "QUEUED" as OutboxStatus,
    payload: {
      ...msg.payload,
    },
  };

  memoryOutbox.push(row);

  if (msg.contestId) {
    try {
      const contest = await prisma.fotorankContest.findUnique({
        where: { id: msg.contestId },
        select: { organizationId: true },
      });
      if (contest?.organizationId) {
        void prisma.fotorankJudgeAuditEvent
          .create({
            data: {
              organizationId: contest.organizationId,
              contestId: msg.contestId,
              actorType: "SYSTEM",
              eventType: `EMAIL_${msg.kind}`,
              entityType: msg.entryId ? "FotorankContestEntry" : "EmailOutbox",
              entityId: msg.entryId ?? msg.registrationId ?? id,
              payloadJson: {
                outboxId: id,
                kind: msg.kind,
                toUserId: msg.toUserId ?? null,
                status: "QUEUED",
              },
            },
          })
          .catch(() => null);
      }
    } catch {
      // no bloquear inscripción
    }
  }

  if (!process.env.RESEND_API_KEY) {
    // Keep QUEUED — UI must not claim the email was sent.
    return { queued: true, id, sent: false };
  }

  try {
    const to = await resolveRecipientEmail(msg);
    if (!to) {
      row.status = "FAILED";
      return { queued: true, id, sent: false };
    }

    let subject = TRANSACTIONAL_EMAIL_TEMPLATES[msg.kind].subject.replace(
      "{{contestTitle}}",
      str(msg.payload.contestTitle),
    );
    let html = `<p>${escapeHtml(subject)}</p>`;
    let text = subject;

    if (msg.kind === "REGISTRATION_CONFIRMED") {
      const built = buildRegistrationConfirmedEmail(msg.payload);
      subject = built.subject;
      html = built.html;
      text = built.text;
    }

    const replyTo =
      str(msg.payload.replyTo) ||
      str(msg.payload.contactEmail) ||
      process.env.FOTORANK_EMAIL_REPLY_TO?.trim() ||
      "sfprosario@gmail.com";

    const idempotencyKey = `${msg.kind}:${msg.registrationId ?? msg.entryId ?? id}`;
    const result = await sendViaResend({
      to,
      subject,
      html,
      text,
      replyTo,
      idempotencyKey,
    });

    if (!result.ok) {
      row.status = "FAILED";
      return { queued: true, id, sent: false };
    }
    row.status = "SENT";
    return { queued: true, id, sent: true };
  } catch {
    row.status = "FAILED";
    return { queued: true, id, sent: false };
  }
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
    subject: "Fotografía recibida — {{contestTitle}}",
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
