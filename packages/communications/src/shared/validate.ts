import { isCommunicationChannel, type CommunicationChannel } from "./channels";
import { CommunicationError } from "./errors";
import type { CommunicationRecipient, CommunicationRequest } from "./types";

export function normalizeRecipients(
  to: CommunicationRecipient | CommunicationRecipient[],
): CommunicationRecipient[] {
  return Array.isArray(to) ? to : [to];
}

export function resolveChannel(
  request: CommunicationRequest,
  defaultChannel: CommunicationChannel,
): CommunicationChannel {
  const channel = request.channel ?? defaultChannel;
  if (!isCommunicationChannel(channel)) {
    throw new CommunicationError(
      "CHANNEL_NOT_SUPPORTED",
      `Canal no soportado: "${String(channel)}"`,
    );
  }
  return channel;
}

/**
 * Validación mínima de solicitud para send().
 * Lanza CommunicationError tipado si es inválida.
 */
export function assertValidSendRequest(request: CommunicationRequest): void {
  if (request.to === undefined || request.to === null) {
    throw new CommunicationError(
      "INVALID_REQUEST",
      "La solicitud requiere al menos un destinatario (to).",
    );
  }

  const recipients = normalizeRecipients(request.to);
  if (recipients.length === 0) {
    throw new CommunicationError(
      "INVALID_REQUEST",
      "La solicitud requiere al menos un destinatario (to).",
    );
  }

  const subject = request.subject ?? request.message?.subject;
  const hasBody =
    Boolean(request.text?.trim()) ||
    Boolean(request.html?.trim()) ||
    Boolean(request.message?.text?.trim()) ||
    Boolean(request.message?.html?.trim());

  if (!subject?.trim() && !request.templateKey && !hasBody) {
    throw new CommunicationError(
      "INVALID_REQUEST",
      "La solicitud requiere subject, templateKey o cuerpo (text/html).",
    );
  }
}

export function flattenMessageFields(request: CommunicationRequest): {
  subject?: string;
  text?: string;
  html?: string;
  attachments: NonNullable<CommunicationRequest["attachments"]>;
  headers?: Record<string, string>;
  tags?: string[];
} {
  return {
    subject: request.subject ?? request.message?.subject,
    text: request.text ?? request.message?.text,
    html: request.html ?? request.message?.html,
    attachments: request.attachments ?? request.message?.attachments ?? [],
    headers: request.headers ?? request.message?.headers,
    tags: request.tags ?? request.message?.tags,
  };
}
