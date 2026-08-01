import type {
  CommunicationProvider,
  CommunicationProviderCapabilities,
  CommunicationProviderSendInput,
} from "../providers/types";
import { CommunicationError } from "../shared/errors";
import { failedResult } from "../shared/result";
import type { CommunicationRecipient, CommunicationResult } from "../shared/types";
import { normalizeRecipients } from "../shared/validate";
import type { EmailAddress, EmailMessage, EmailSendResult } from "./types";

function toEmailAddresses(
  recipients: CommunicationRecipient[] | undefined,
): EmailAddress[] | undefined {
  if (!recipients?.length) return undefined;
  const addresses: EmailAddress[] = [];
  for (const recipient of recipients) {
    const email = recipient.email?.trim();
    if (email) addresses.push({ email });
  }
  return addresses.length > 0 ? addresses : undefined;
}

/**
 * Provider abstracto de email.
 * Los adaptadores concretos (Resend, SES, Postmark, Mailgun) extienden esta clase.
 */
export abstract class EmailProvider implements CommunicationProvider {
  abstract readonly name: string;
  readonly channel = "email" as const;

  abstract readonly capabilities: CommunicationProviderCapabilities;

  abstract sendEmail(message: EmailMessage): Promise<EmailSendResult>;

  /**
   * Adaptador al contrato multi-canal.
   * Normaliza errores lanzados a CommunicationResult failed.
   */
  async send(input: CommunicationProviderSendInput): Promise<CommunicationResult> {
    try {
      const message = this.toEmailMessage(input);
      return await this.sendEmail(message);
    } catch (error) {
      if (error instanceof CommunicationError) {
        return failedResult({
          channel: "email",
          provider: this.name,
          errorCode: error.code,
          errorMessage: error.message,
          dryRun: input.dryRun,
          metadata: input.metadata,
        });
      }
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido en EmailProvider";
      return failedResult({
        channel: "email",
        provider: this.name,
        errorCode: "SEND_FAILED",
        errorMessage,
        dryRun: input.dryRun,
        metadata: input.metadata,
      });
    }
  }

  protected toEmailMessage(input: CommunicationProviderSendInput): EmailMessage {
    const fromEmail = input.from?.email?.trim();
    if (!fromEmail) {
      throw new CommunicationError(
        "CONFIGURATION_ERROR",
        `Provider "${this.name}" requiere from.email.`,
      );
    }

    const subject = input.subject?.trim() ?? "";
    if (!subject && !input.templateKey) {
      throw new CommunicationError(
        "INVALID_REQUEST",
        `Provider "${this.name}" requiere subject o templateKey.`,
      );
    }

    const recipients = normalizeRecipients(input.to);
    this.requireEmails(recipients);

    return {
      to: input.to,
      from: { email: fromEmail, name: input.from?.name },
      subject: subject || input.templateKey || "",
      text: input.text,
      html: input.html,
      replyTo: input.replyTo,
      cc: toEmailAddresses(input.cc),
      bcc: toEmailAddresses(input.bcc),
      attachments: input.attachments,
      tags: input.tags,
      headers: input.headers,
      idempotencyKey: input.idempotencyKey,
      metadata: {
        ...input.metadata,
        ...(input.templateKey ? { templateKey: input.templateKey } : {}),
      },
      dryRun: input.dryRun,
    };
  }

  protected requireEmails(recipients: CommunicationRecipient[]): string[] {
    const emails: string[] = [];
    for (const recipient of recipients) {
      const email = recipient.email?.trim();
      if (!email) {
        throw new CommunicationError(
          "INVALID_RECIPIENT",
          "Todo destinatario de email debe incluir recipient.email.",
          { recipientId: recipient.id ?? null },
        );
      }
      emails.push(email);
    }
    return emails;
  }

  protected resolveReplyTo(replyTo?: string | EmailAddress): string | undefined {
    if (!replyTo) return undefined;
    return typeof replyTo === "string" ? replyTo : replyTo.email;
  }

  protected normalizeRecipients(
    to: CommunicationRecipient | CommunicationRecipient[],
  ): CommunicationRecipient[] {
    return normalizeRecipients(to);
  }
}
