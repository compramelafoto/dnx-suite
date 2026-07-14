import { marathonCatalog } from "@/content/demo-marathon";
import type { PublicMarathon, PublicScheduleItem } from "@/types/marathon";

/** Catálogo local provisional. En el futuro lo reemplaza FotoRank. */
export function listMarathons(): PublicMarathon[] {
  return [...marathonCatalog];
}

export function listPublicMarathons(): PublicMarathon[] {
  return listMarathons().filter((m) => !m.isDemo && m.status !== "draft" && m.status !== "cancelled");
}

export function getMarathonBySlug(slug: string): PublicMarathon | undefined {
  return listMarathons().find((m) => m.slug === slug);
}

export function getMarathonSlugs(): string[] {
  return listMarathons().map((m) => m.slug);
}

/** Ítems de cronograma visibles antes del evento. */
export function getPublicSchedule(
  marathon: Pick<PublicMarathon, "schedule" | "status">,
): PublicScheduleItem[] {
  const duringOrAfter =
    marathon.status === "in_progress" ||
    marathon.status === "judging" ||
    marathon.status === "results_published" ||
    marathon.status === "archived";

  return marathon.schedule
    .filter((item) => item.publicBeforeEvent || duringOrAfter)
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
