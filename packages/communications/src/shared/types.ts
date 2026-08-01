import type { CommunicationChannel } from "./channels";
import type { CommunicationErrorCode } from "./errors";

/**
 * Metadatos no sensibles adjuntos a un envío o evento.
 * Prohibido: API keys, tokens, HTML/cuerpo completo, PII innecesaria.
 */
export type CommunicationMetadata = Record<
  string,
  string | number | boolean | null | undefined
>;

/** Destinatario canónico multi-canal. */
export interface CommunicationRecipient {
  /** Identificador interno (userId, registrationId, etc.). */
  id?: string;
  email?: string;
  phone?: string;
  pushToken?: string;
  locale?: string;
  timezone?: string;
  /** Variables de personalización (nombre, etc.). Evitar PII innecesaria en logs. */
  variables?: Record<string, string | number | boolean | null | undefined>;
  metadata?: CommunicationMetadata;
}

/** Adjunto de mensaje (email u otros canales que lo soporten). */
export interface CommunicationAttachment {
  filename: string;
  contentType: string;
  /** Contenido en base64 o bytes; el provider decide el transporte. */
  content: string | Uint8Array;
  contentId?: string;
  disposition?: "attachment" | "inline";
}

/** Cuerpo de mensaje desacoplado del canal. */
export interface CommunicationMessage {
  subject?: string;
  text?: string;
  html?: string;
  attachments?: CommunicationAttachment[];
  headers?: Record<string, string>;
  tags?: string[];
}

/**
 * Estado normalizado de una operación de comunicación.
 */
export type CommunicationStatus =
  | "success"
  | "failed"
  | "scheduled"
  | "skipped";

/**
 * Resultado normalizado. Independiente del proveedor concreto.
 */
export interface CommunicationResult {
  status: CommunicationStatus;
  /** true solo cuando status === "success". */
  ok: boolean;
  channel: CommunicationChannel;
  /** Nombre del provider (p. ej. "resend", "memory-mail"). */
  provider?: string;
  /** Id interno del intento. */
  communicationId?: string;
  /** Id del proveedor externo. */
  providerMessageId?: string;
  errorCode?: CommunicationErrorCode | string;
  errorMessage?: string;
  /** true si no se contactó infraestructura externa. */
  dryRun?: boolean;
  metadata?: CommunicationMetadata;
}

/**
 * Solicitud canónica hacia la fachada / providers.
 * No todas las propiedades son obligatorias; la validación depende del canal.
 */
export interface CommunicationRequest {
  channel?: CommunicationChannel;
  to: CommunicationRecipient | CommunicationRecipient[];
  from?: {
    email?: string;
    name?: string;
    phone?: string;
  };
  cc?: CommunicationRecipient[];
  bcc?: CommunicationRecipient[];
  replyTo?: string;
  /** Preferido: anidar en message. Los campos planos se aceptan por ergonomía. */
  message?: CommunicationMessage;
  subject?: string;
  text?: string;
  html?: string;
  attachments?: CommunicationAttachment[];
  headers?: Record<string, string>;
  tags?: string[];
  templateKey?: string;
  templateVariables?: Record<string, string | number | boolean | null | undefined>;
  /** Preparado para deduplicación futura; opcional en etapa 01. */
  idempotencyKey?: string;
  metadata?: CommunicationMetadata;
  /** Si true, el provider no debe contactar infraestructura externa. */
  dryRun?: boolean;
}

/** Entrada de log interno (auditoría / debugging). */
export interface CommunicationLog {
  id: string;
  at: Date;
  level: "debug" | "info" | "warn" | "error";
  channel?: CommunicationChannel;
  provider?: string;
  event?: string;
  message: string;
  communicationId?: string;
  metadata?: CommunicationMetadata;
}

/** Evento de dominio tipado (automatizaciones futuras). */
export interface CommunicationEvent<TPayload = Record<string, unknown>> {
  type: string;
  occurredAt: Date;
  sourceApp?: string;
  sourceEntityType?: string;
  sourceEntityId?: string;
  payload: TPayload;
  metadata?: CommunicationMetadata;
  /** Clave de idempotencia estable para deduplicar triggers. */
  idempotencyKey?: string;
}

/** Definición abstracta de plantilla (sin HTML en etapa 01). */
export interface CommunicationTemplate {
  id: string;
  key: string;
  channel: CommunicationChannel;
  version: number;
  locale?: string;
  subject?: string;
  layoutId?: string;
  componentIds?: string[];
  variables?: CommunicationTemplateVariable[];
  brandingId?: string;
  metadata?: CommunicationMetadata;
}

export interface CommunicationTemplateVariable {
  name: string;
  required?: boolean;
  description?: string;
  defaultValue?: string | number | boolean | null;
}
