import type {
  CommunicationAttachment,
  CommunicationMetadata,
  CommunicationRecipient,
  CommunicationResult,
} from "../shared/types";

export type EmailAddress = {
  email: string;
  name?: string;
};

/**
 * Mensaje de email tipado para EmailProvider.
 * Sin tipos internos de Resend / SES / Postmark.
 */
export type EmailMessage = {
  to: CommunicationRecipient | CommunicationRecipient[];
  from: EmailAddress;
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string | EmailAddress;
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  attachments?: CommunicationAttachment[];
  tags?: string[];
  headers?: Record<string, string>;
  idempotencyKey?: string;
  metadata?: CommunicationMetadata;
  dryRun?: boolean;
};

export type EmailSendResult = CommunicationResult & {
  channel: "email";
};
