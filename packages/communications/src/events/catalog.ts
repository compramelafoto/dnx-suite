/**
 * Catálogo tipado de eventos de dominio para automatizaciones futuras.
 *
 * Payloads = placeholders mínimos (IDs). No inventar campos de negocio
 * hasta verificar modelos reales de cada app.
 */
export const COMMUNICATION_EVENT_TYPES = [
  "user.welcome",
  "purchase.completed",
  "payment.failed",
  "album.created",
  "album.expiring",
  "new.sale",
  "contest.registered",
  "contest.started",
  "contest.finished",
  "news.published",
] as const;

export type CommunicationEventType = (typeof COMMUNICATION_EVENT_TYPES)[number];

export function isCommunicationEventType(value: string): value is CommunicationEventType {
  return (COMMUNICATION_EVENT_TYPES as readonly string[]).includes(value);
}

/**
 * Mapa evento → payload mínimo.
 * Campos opcionales son placeholders documentados, no contratos de producto finales.
 */
export type CommunicationEventPayloadMap = {
  /** Placeholder: alta / bienvenida de usuario. */
  "user.welcome": {
    userId: string;
  };
  /** Placeholder: compra completada. */
  "purchase.completed": {
    orderId: string;
    userId: string;
  };
  /** Placeholder: pago fallido. */
  "payment.failed": {
    paymentId: string;
    userId?: string;
  };
  /** Placeholder: álbum creado. */
  "album.created": {
    albumId: string;
    userId?: string;
  };
  /** Placeholder: álbum por expirar. */
  "album.expiring": {
    albumId: string;
    /** ISO-8601 placeholder. */
    expiresAt: string;
  };
  /** Placeholder: nueva venta. */
  "new.sale": {
    saleId: string;
    userId?: string;
  };
  /** Placeholder: inscripción a concurso. */
  "contest.registered": {
    contestId: string;
    registrationId: string;
    userId?: string;
  };
  /** Placeholder: concurso iniciado. */
  "contest.started": {
    contestId: string;
  };
  /** Placeholder: concurso finalizado. */
  "contest.finished": {
    contestId: string;
  };
  /** Placeholder: noticia publicada. */
  "news.published": {
    newsId: string;
  };
};
