import type { ClickatonRegistrationStatus } from "@/lib/registration/domain/types";

/**
 * Los estados que el selector del listado ofrece filtrar.
 *
 * Están acá y no sueltos en la página porque un test verifica que cada uno sea
 * aceptado por `filtersFromSearchParams`: una opción que la lista blanca no
 * conoce se descarta en silencio y el filtro parece no hacer nada.
 */
export const REGISTRATION_STATUS_FILTER_OPTIONS: ClickatonRegistrationStatus[] = [
  "DRAFT",
  "PENDING_PAYMENT",
  "CONFIRMED",
  "GIFT_AWAITING_REDEMPTION",
  "WAITLISTED",
  "CANCELLED",
  "REFUNDED",
  "DISQUALIFIED",
];
