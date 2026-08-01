/**
 * Tipos externos del webhook Resend (capa de traducción).
 * El dominio no consume estos tipos fuera del adapter.
 */

export const RESEND_EMAIL_WEBHOOK_TYPES = [
  "email.sent",
  "email.delivered",
  "email.delivery_delayed",
  "email.bounced",
  "email.complained",
  "email.opened",
  "email.clicked",
  "email.failed",
  "email.suppressed",
] as const;

export type ResendEmailWebhookType = (typeof RESEND_EMAIL_WEBHOOK_TYPES)[number];

export type ResendWebhookClickData = {
  link?: string;
  timestamp?: string;
};

export type ResendWebhookBounceData = {
  message?: string;
  type?: string;
};

/**
 * Subconjunto mínimo del objeto `data` de Resend.
 * Campos sensibles (IP, UA, subject, HTML) se ignoran a propósito.
 */
export type ResendWebhookData = {
  email_id?: string;
  to?: string[] | string;
  created_at?: string;
  click?: ResendWebhookClickData;
  bounce?: ResendWebhookBounceData;
  /** Algunos payloads usan bounce a nivel root de data. */
  bounce_type?: string;
  reason?: string;
};

export type ResendWebhookEnvelope = {
  type: string;
  created_at?: string;
  data?: ResendWebhookData;
};

export const DEFAULT_WEBHOOK_MAX_BYTES = 65_536;
