import { homeContent } from "@/content/home";
import { marathonPath, marathonRegistrationPath, routes } from "@/config/navigation";
import type { HomeSpotlightSlide } from "@/components/home/HomeSpotlightBanner";
import type { PublicMarathon } from "@/types/marathon";

/** Combina próximas ediciones publicadas + novedades editoriales del home. */
export function buildHomeSpotlightSlides(
  editions: PublicMarathon[],
): HomeSpotlightSlide[] {
  const upcoming = editions
    .filter((m) => !m.isDemo)
    .slice(0, 6)
    .map((edition): HomeSpotlightSlide => {
      const canRegister = Boolean(edition.registration?.canRegister);
      const dateLabel = new Date(edition.startAt).toLocaleDateString("es-AR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      return {
        id: `edition-${edition.id}`,
        kind: "edition",
        eyebrow: edition.city ? `Próxima · ${edition.city}` : "Próxima edición",
        title: edition.name,
        description:
          edition.shortDescription ||
          `${dateLabel}${edition.registration?.displayPrice?.formatted ? ` · ${edition.registration.displayPrice.formatted}` : ""}`,
        href: canRegister
          ? marathonRegistrationPath(edition.slug)
          : marathonPath(edition.slug),
        ctaLabel: canRegister ? "Inscribirme" : "Ver edición",
        secondaryHref: routes.marathons,
        secondaryCtaLabel: "Ver todas",
        imageUrl: edition.coverImage,
        imageUrlVertical: edition.coverImageVertical,
      };
    });

  const news: HomeSpotlightSlide[] = homeContent.spotlightNews.map((item) => ({
    id: item.id,
    kind: "news",
    eyebrow: item.eyebrow,
    title: item.title,
    description: item.description,
    href: item.href,
    ctaLabel: item.ctaLabel,
    secondaryHref: item.secondaryHref,
    secondaryCtaLabel: item.secondaryCtaLabel,
    imageUrl: item.imageUrl,
  }));

  // Ediciones primero (van pasando una tras otra); novedades/acciones al final.
  return [...upcoming, ...news];
}
