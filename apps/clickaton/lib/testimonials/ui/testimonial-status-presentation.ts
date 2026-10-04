/**
 * Cómo se lee el estado de un testimonio en el panel.
 *
 * "Sin autorización" y "Pendiente de revisión" son dos cosas distintas: en el
 * primer caso no hay nada que decidir, en el segundo la decisión es tuya.
 */
import type { ClickatonTestimonialStatus } from "../domain/types";

export type StatusTone = "neutral" | "success" | "warning" | "danger";

export type StatusPresentation = { label: string; tone: StatusTone };

export function presentTestimonialStatus(
  status: ClickatonTestimonialStatus | null,
  publicationConsent: boolean,
): StatusPresentation {
  if (status === null) return { label: "Sólo encuesta", tone: "neutral" };
  if (!publicationConsent) return { label: "Sin autorización", tone: "neutral" };

  switch (status) {
    case "PUBLISHED":
      return { label: "Publicado", tone: "success" };
    case "REJECTED":
      return { label: "Rechazado", tone: "danger" };
    case "PENDING":
    default:
      return { label: "Pendiente de revisión", tone: "warning" };
  }
}

export type PublishGate = { allowed: true } | { allowed: false; reason: string };

export function canPublish(testimonial: {
  status: ClickatonTestimonialStatus;
  publicationConsent: boolean;
}): PublishGate {
  if (!testimonial.publicationConsent) {
    return {
      allowed: false,
      reason: "Quien lo escribió no autorizó que se publique.",
    };
  }
  if (testimonial.status === "PUBLISHED") {
    return { allowed: false, reason: "Ya está publicado." };
  }
  return { allowed: true };
}

/** Un NPS suelto no dice nada. La etiqueta lo pone en escala. */
export function npsToneLabel(score: number): string {
  if (score >= 50) return "Excelente";
  if (score >= 1) return score >= 30 ? "Bueno" : "Mejorable";
  return "Crítico";
}
