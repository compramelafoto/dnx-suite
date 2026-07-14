/**
 * Helpers de presentación para la ficha (no son fuente de datos).
 * El acceso a catálogo vive en `@/data/public-marathons`.
 */

import { isScheduleItemPublic } from "@/data/public-marathons/visibility";
import type { PublicMarathon, PublicScheduleItem } from "@/types/marathon";

/** Ítems de cronograma visibles (idempotente si el payload ya viene sanitizado). */
export function getPublicSchedule(
  marathon: Pick<PublicMarathon, "schedule" | "status">,
): PublicScheduleItem[] {
  return marathon.schedule
    .filter((item) => isScheduleItemPublic(item, marathon.status))
    .sort((a, b) => a.startAt.localeCompare(b.startAt));
}

export function marathonLocationLabel(marathon: PublicMarathon): string {
  return [marathon.city, marathon.provinceOrRegion, marathon.country].filter(Boolean).join(", ");
}

export function canShowRegistrationCta(marathon: PublicMarathon): boolean {
  return (
    marathon.registrationStatus === "open" || marathon.registrationStatus === "last_places"
  );
}
