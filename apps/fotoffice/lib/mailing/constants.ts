/**
 * Correo a socios (Comunicación → Correo). Constantes compartidas entre servidor y pantallas: este
 * módulo no importa Prisma.
 * Spec: docs/superpowers/specs/2026-10-05-correo-a-socios-etapas-1-2-design.md
 */

/** Temas de baja. "all" = ningún correo masivo de la institución. */
export const MAILING_TOPICS = ["novedades", "blog", "efemerides", "saludos", "all"] as const;
export type MailingTopic = (typeof MAILING_TOPICS)[number];

export const MAILING_TOPIC_LABEL: Record<MailingTopic, string> = {
  novedades: "Novedades de la institución",
  blog: "Novedades del blog",
  efemerides: "Saludos por fechas especiales",
  saludos: "Saludos de cumpleaños y aniversario",
  all: "Todos los correos de la institución",
};

/** Cómo se nombra cada tema dentro de una frase («dejar de recibir …»). */
export const MAILING_TOPIC_PHRASE: Record<MailingTopic, string> = {
  novedades: "las novedades de la institución",
  blog: "las novedades del blog",
  efemerides: "los saludos por fechas especiales",
  saludos: "los saludos de cumpleaños y aniversario",
  all: "todos los correos de novedades",
};

export const CAMPAIGN_KINDS = {
  BLOG_POST: "BLOG_POST",
  BLOG_DIGEST: "BLOG_DIGEST",
  OCCASION: "OCCASION",
  BIRTHDAY: "BIRTHDAY",
  ANNIVERSARY: "ANNIVERSARY",
  CUSTOM: "CUSTOM",
  LIFECYCLE: "LIFECYCLE",
} as const;
export type CampaignKind = (typeof CAMPAIGN_KINDS)[keyof typeof CAMPAIGN_KINDS];

export const CAMPAIGN_KIND_LABEL: Record<string, string> = {
  BLOG_POST: "Artículo del blog",
  BLOG_DIGEST: "Resumen semanal del blog",
  OCCASION: "Fecha especial",
  BIRTHDAY: "Cumpleaños",
  ANNIVERSARY: "Aniversario de ingreso",
  CUSTOM: "Campaña",
  LIFECYCLE: "Ciclo del socio",
};

/** Estados de una campaña libre (FotofficeMailingMessage). */
export const MESSAGE_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Borrador",
  PENDING_APPROVAL: "Esperando aprobación",
  SCHEDULED: "Programada",
  SENT: "Enviada",
};

export const CAMPAIGN_STATUS_LABEL: Record<string, string> = {
  SENDING: "Enviando",
  SENT: "Enviado",
  FAILED: "Con errores",
};

/** Correos por llamada a Resend. El tope del proveedor es 100; 50 deja margen de tamaño. */
export const MAILING_BATCH_SIZE = 50;
/** Pausa entre tandas: Resend admite pocas llamadas por segundo. */
export const MAILING_BATCH_PAUSE_MS = 700;
/** Una fila tomada hace más que esto sin resolverse se considera abandonada y se reintenta. */
export const MAILING_STALE_CLAIM_MS = 15 * 60 * 1000;

/** Marca de las pruebas en `SentEmailLog`. */
export const MAILING_TEST_TEMPLATE_KEY = "fotoffice.mailing.test";
