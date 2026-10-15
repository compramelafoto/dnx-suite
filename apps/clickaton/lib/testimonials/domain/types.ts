/**
 * Contratos del módulo de testimonios, alineados al schema de Prisma.
 *
 * Se declaran acá y no se importan del cliente de Prisma, igual que el resto
 * del dominio de Clickatón: así el dominio se puede probar sin arrastrar el
 * cliente generado.
 */

export type ClickatonTestimonialAuthorRole = "PARTICIPANT" | "JUROR" | "VENUE";

export type ClickatonTestimonialStatus = "PENDING" | "PUBLISHED" | "REJECTED";

export type ClickatonSurveyWouldReturn = "YES" | "MAYBE" | "NO";

export type ClickatonTestimonialInviteStatus =
  | "PENDING"
  | "SENT"
  | "FAILED"
  | "RESPONDED";
