import { EmailProvider } from "../email-provider";
import type { EmailMessage, EmailSendResult } from "../types";
import type { CommunicationProviderCapabilities } from "../../providers/types";
import { CommunicationError } from "../../shared/errors";
import type { CommunicationErrorCode } from "../../shared/errors";
import {
  createCommunicationLogger,
  type CommunicationLogger,
} from "../../shared/logger";
import { failedResult, skippedResult, successResult } from "../../shared/result";
import type { ResendClientLike } from "./resend-client";

export type ResendProviderOptions = {
  client?: ResendClientLike;
  defaultFrom?: { email: string; name?: string };
  /**
   * Default true: nunca contacta al client.
   */
  dryRun?: boolean;
  logger?: CommunicationLogger;
  /** Código de skip cuando dryRun (default DRY_RUN). */
  dryRunErrorCode?: CommunicationErrorCode;
  dryRunErrorMessage?: string;
};

function createCommunicationId(): string {
  return `comm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function formatFrom(from: { email: string; name?: string }): string {
  return from.name ? `${from.name} <${from.email}>` : from.email;
}

function mapProviderErrorName(
  name: string | undefined,
): CommunicationErrorCode {
  const n = (name ?? "").toLowerCase();
  if (n.includes("auth") || n.includes("unauthorized") || n.includes("api_key")) {
    return "PROVIDER_AUTHENTICATION_FAILED";
  }
  if (n.includes("rate") || n.includes("throttle")) {
    return "PROVIDER_RATE_LIMITED";
  }
  return "PROVIDER_REJECTED";
}

/**
 * EmailProvider Resend — depende solo de ResendClientLike.
 * Sin SDK, sin env, sin side effects al importar.
 */
export class ResendProvider extends EmailProvider {
  readonly name = "resend";
  readonly capabilities: CommunicationProviderCapabilities = {
    supportsAttachments: true,
    supportsScheduling: false,
    supportsTracking: true,
    supportsTemplates: false,
  };

  private readonly client?: ResendClientLike;
  private readonly defaultFrom?: { email: string; name?: string };
  private readonly defaultDryRun: boolean;
  private readonly logger: CommunicationLogger;
  private readonly dryRunErrorCode: CommunicationErrorCode;
  private readonly dryRunErrorMessage: string;

  constructor(options: ResendProviderOptions = {}) {
    super();
    this.client = options.client;
    this.defaultFrom = options.defaultFrom;
    this.defaultDryRun = options.dryRun ?? true;
    this.dryRunErrorCode = options.dryRunErrorCode ?? "DRY_RUN";
    this.dryRunErrorMessage =
      options.dryRunErrorMessage ??
      "Dry-run activo: no se envió email. Pasá dryRun:false y un client inyectado para live.";
    this.logger =
      options.logger ??
      createCommunicationLogger({ channel: "email", provider: this.name });
  }

  async sendEmail(message: EmailMessage): Promise<EmailSendResult> {
    const dryRun = message.dryRun ?? this.defaultDryRun;
    const communicationId = createCommunicationId();
    const from = message.from?.email ? message.from : this.defaultFrom;

    if (!from?.email) {
      throw new CommunicationError(
        "CONFIGURATION_ERROR",
        "ResendProvider requiere from.email en el mensaje o defaultFrom en opciones.",
      );
    }

    const recipients = this.normalizeRecipients(message.to);
    const emails = this.requireEmails(recipients);

    if (dryRun) {
      this.logger.info("Dry-run: no se contactó Resend", {
        communicationId,
        toCount: emails.length,
        hasSubject: Boolean(message.subject),
      });
      return {
        ...skippedResult({
          channel: "email",
          provider: this.name,
          communicationId,
          dryRun: true,
          errorCode: this.dryRunErrorCode,
          errorMessage: this.dryRunErrorMessage,
          metadata: message.metadata,
        }),
        channel: "email",
      };
    }

    if (!this.client) {
      throw new CommunicationError(
        "CONFIGURATION_ERROR",
        "ResendProvider en modo live requiere un client inyectado (ResendClientLike).",
      );
    }

    try {
      const response = await this.client.emails.send({
        from: formatFrom(from),
        to: emails.length === 1 ? emails[0]! : emails,
        subject: message.subject,
        html: message.html,
        text: message.text,
        reply_to: this.resolveReplyTo(message.replyTo),
        cc: message.cc?.map((a) => a.email),
        bcc: message.bcc?.map((a) => a.email),
        attachments: message.attachments?.map((attachment) => ({
          filename: attachment.filename,
          content: attachment.content,
          content_id: attachment.contentId,
        })),
        tags: message.tags?.map((tag) => ({ name: "tag", value: tag })),
        headers: {
          ...message.headers,
          ...(message.idempotencyKey
            ? { "Idempotency-Key": message.idempotencyKey }
            : {}),
        },
      });

      if (response.error) {
        const errorCode = mapProviderErrorName(response.error.name);
        this.logger.error("Resend rechazó el envío", {
          communicationId,
          errorCode,
        });
        return {
          ...failedResult({
            channel: "email",
            provider: this.name,
            communicationId,
            dryRun: false,
            errorCode,
            errorMessage: response.error.message,
            metadata: message.metadata,
          }),
          channel: "email",
        };
      }

      const providerMessageId = response.data?.id;
      if (!providerMessageId) {
        this.logger.error("Resend sin providerMessageId", {
          communicationId,
          errorCode: "PROVIDER_RESPONSE_INVALID",
        });
        return {
          ...failedResult({
            channel: "email",
            provider: this.name,
            communicationId,
            dryRun: false,
            errorCode: "PROVIDER_RESPONSE_INVALID",
            errorMessage:
              "Resend no devolvió message id — no se considera éxito.",
            metadata: message.metadata,
          }),
          channel: "email",
        };
      }

      this.logger.info("Email aceptado por Resend", {
        communicationId,
        hasProviderMessageId: true,
      });

      return {
        ...successResult({
          channel: "email",
          provider: this.name,
          communicationId,
          providerMessageId,
          dryRun: false,
          metadata: message.metadata,
        }),
        channel: "email",
      };
    } catch (error) {
      const raw =
        error instanceof Error ? error.message : "Error desconocido al llamar Resend";
      const lower = raw.toLowerCase();
      let errorCode: CommunicationErrorCode = "SEND_FAILED";
      if (lower.includes("unauthorized") || lower.includes("api key")) {
        errorCode = "PROVIDER_AUTHENTICATION_FAILED";
      } else if (lower.includes("rate limit")) {
        errorCode = "PROVIDER_RATE_LIMITED";
      }
      this.logger.error("Excepción en ResendProvider", {
        communicationId,
        errorCode,
      });
      return {
        ...failedResult({
          channel: "email",
          provider: this.name,
          communicationId,
          dryRun: false,
          errorCode,
          errorMessage: raw.slice(0, 180),
          metadata: message.metadata,
        }),
        channel: "email",
      };
    }
  }
}

export function createResendProvider(options?: ResendProviderOptions): ResendProvider {
  return new ResendProvider(options);
}
