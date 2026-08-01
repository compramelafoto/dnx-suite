import type { CommunicationChannel } from "../shared/channels";
import type {
  CommunicationAttachment,
  CommunicationMetadata,
  CommunicationRecipient,
  CommunicationResult,
} from "../shared/types";

/**
 * Contrato base de cualquier proveedor de comunicaciones.
 * Email, WhatsApp, Push, SMS e In-App deben implementar este shape.
 */
export interface CommunicationProvider {
  readonly name: string;
  readonly channel: CommunicationChannel;

  readonly capabilities?: CommunicationProviderCapabilities;

  send(input: CommunicationProviderSendInput): Promise<CommunicationResult>;
}

export type CommunicationProviderCapabilities = {
  supportsAttachments?: boolean;
  supportsScheduling?: boolean;
  supportsTracking?: boolean;
  supportsTemplates?: boolean;
};

/**
 * Input normalizado hacia un provider.
 * Sin tipos internos de Resend ni de ningún PSP.
 */
export type CommunicationProviderSendInput = {
  to: CommunicationRecipient | CommunicationRecipient[];
  from?: {
    email?: string;
    name?: string;
    phone?: string;
  };
  cc?: CommunicationRecipient[];
  bcc?: CommunicationRecipient[];
  replyTo?: string;
  subject?: string;
  text?: string;
  html?: string;
  templateKey?: string;
  templateVariables?: Record<string, string | number | boolean | null | undefined>;
  attachments?: CommunicationAttachment[];
  headers?: Record<string, string>;
  tags?: string[];
  idempotencyKey?: string;
  metadata?: CommunicationMetadata;
  dryRun?: boolean;
};

export type ProviderChannelKey = CommunicationChannel;

export type RegisterProviderOptions = {
  /**
   * Si true, reemplaza un provider ya registrado para el canal.
   * Si false (default) y ya existe → CommunicationError PROVIDER_ALREADY_REGISTERED.
   */
  replace?: boolean;
};
