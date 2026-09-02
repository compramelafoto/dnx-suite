import type { GalleryStatus, PublicMarathon, ResultsStatus } from "@/types/marathon";

/**
 * Visibilidad pública derivada del estado estructural.
 * Las páginas no deben reimplementar estas reglas.
 */
export type PublicMarathonVisibility = {
  /** Aparece en listado comercial / catálogo público. */
  listed: boolean;
  /** Puede resolverse por `/maratones/[slug]`. */
  routable: boolean;
  /** Candidata a indexación cuando el sitio salga de prelanzamiento. */
  indexable: boolean;
  isDemo: boolean;
  /** Oculta: routable por link, nunca listada ni indexable. */
  isUnlisted: boolean;
  archived: boolean;
  cancelled: boolean;
  draft: boolean;
};

export function getPublicMarathonVisibility(
  marathon: Pick<PublicMarathon, "status" | "isDemo" | "isUnlisted">,
): PublicMarathonVisibility {
  const isDemo = Boolean(marathon.isDemo);
  const isUnlisted = Boolean(marathon.isUnlisted);
  const draft = marathon.status === "draft";
  const cancelled = marathon.status === "cancelled";
  const archived = marathon.status === "archived";

  const listed = !isDemo && !isUnlisted && !draft && !cancelled;
  const routable = !draft && (isDemo || isUnlisted || !cancelled);
  // Demos, ocultas y borradores nunca indexables. El sitio hoy fuerza noindex global.
  const indexable = listed && !isDemo && !isUnlisted && !draft && !cancelled;

  return {
    listed,
    routable,
    indexable,
    isDemo,
    isUnlisted,
    archived,
    cancelled,
    draft,
  };
}

export function canShowPublicResults(status: ResultsStatus): boolean {
  return status === "published" || status === "partial";
}

export function canShowPublicGallery(status: GalleryStatus): boolean {
  return status === "published";
}

export function isScheduleItemPublic(
  item: { publicBeforeEvent: boolean },
  marathonStatus: PublicMarathon["status"],
): boolean {
  if (item.publicBeforeEvent) return true;
  return (
    marathonStatus === "in_progress" ||
    marathonStatus === "judging" ||
    marathonStatus === "results_published" ||
    marathonStatus === "archived"
  );
}
