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

export function marathonLocationLabel(
  marathon: Pick<PublicMarathon, "city" | "provinceOrRegion" | "country" | "venueName">,
): string {
  return [marathon.city, marathon.provinceOrRegion, marathon.country].filter(Boolean).join(", ");
}

/**
 * CTA de inscripción: estado de fechas + capability real.
 * Sin `capabilities` (fixture legacy): solo registrationStatus.
 * Con capabilities: exige `canRegister` (FotoRank V1 hoy es false).
 */
export function canShowRegistrationCta(
  marathon: PublicMarathon,
  capabilities?: { canRegister: boolean } | null,
): boolean {
  const statusAllows =
    marathon.registrationStatus === "open" ||
    marathon.registrationStatus === "last_places";
  if (!statusAllows) return false;
  if (capabilities && !capabilities.canRegister) return false;
  return true;
}
