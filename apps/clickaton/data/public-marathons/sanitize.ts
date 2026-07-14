import { getPublicVisibleChallenges } from "@/lib/challenges";
import { isScheduleItemPublic } from "@/data/public-marathons/visibility";
import type { PublicMarathon, PublicScheduleItem } from "@/types/marathon";

/**
 * Filtra campos sensibles antes de entregar el objeto a páginas/UI.
 * La seguridad no depende de CSS ni de filtros solo en el componente.
 */
export function sanitizePublicMarathon(marathon: PublicMarathon): PublicMarathon {
  const schedule: PublicScheduleItem[] = marathon.schedule
    .filter((item) => isScheduleItemPublic(item, marathon.status))
    .sort((a, b) => a.startAt.localeCompare(b.startAt));

  const challenges = getPublicVisibleChallenges(marathon);

  return {
    ...marathon,
    schedule,
    challenges,
    // Preview de galería vacía hasta contrato de galería publicado
    galleryPreview: Array.isArray(marathon.galleryPreview) ? [...marathon.galleryPreview] : [],
  };
}

/** Copia superficial inmutable del catálogo de entrada. */
export function clonePublicMarathon(marathon: PublicMarathon): PublicMarathon {
  return {
    ...marathon,
    allowedDevices: [...marathon.allowedDevices],
    galleryPreview: [...marathon.galleryPreview],
    categories: marathon.categories.map((c) => ({
      ...c,
      allowedDevices: [...c.allowedDevices],
    })),
    schedule: marathon.schedule.map((s) => ({ ...s })),
    prizes: marathon.prizes.map((p) => ({ ...p })),
    jury: marathon.jury.map((j) => ({ ...j })),
    sponsors: marathon.sponsors.map((s) => ({ ...s })),
    faq: marathon.faq.map((f) => ({ ...f })),
    challenges: marathon.challenges?.map((c) => ({ ...c })),
    organizer: { ...marathon.organizer },
    localVenue: marathon.localVenue ? { ...marathon.localVenue } : undefined,
    rules: marathon.rules ? { ...marathon.rules } : undefined,
    validationPolicy: marathon.validationPolicy
      ? {
          ...marathon.validationPolicy,
          notes: marathon.validationPolicy.notes
            ? [...marathon.validationPolicy.notes]
            : undefined,
          rules: marathon.validationPolicy.rules
            ? marathon.validationPolicy.rules.map((r) => ({ ...r }))
            : undefined,
        }
      : undefined,
    socialLinks: marathon.socialLinks ? { ...marathon.socialLinks } : undefined,
  };
}
