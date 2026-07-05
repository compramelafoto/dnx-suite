import type { ReactNode } from "react";
import {
  isModuleEnabled,
  ORGANIZER_LANDING_MODULE_IDS,
  type OrganizerLandingModuleId,
} from "@/lib/organizer-landing-modules";
import OrganizerSponsorsCarousel from "@/components/organizer/OrganizerSponsorsCarousel";
import {
  OrganizerContactSection,
  OrganizerEventsSection,
  OrganizerFeaturedGalleriesSection,
  OrganizerPhotographerCallSection,
  OrganizerPhotographersSection,
} from "@/components/organizer/landing/OrganizerPublicLandingSections";
import type { OrganizerPublicLandingView } from "@/lib/organizer-public-landing-server";

function sortedContentModules(modules: OrganizerPublicLandingView["modules"]): OrganizerLandingModuleId[] {
  return [...ORGANIZER_LANDING_MODULE_IDS]
    .filter((id) => id !== "hero" && id !== "contact")
    .filter((id) => isModuleEnabled(modules, id))
    .sort((a, b) => (modules[a]?.order ?? 0) - (modules[b]?.order ?? 0));
}

export default function OrganizerPublicLandingPage({ landing }: { landing: OrganizerPublicLandingView }) {
  const primary = landing.primaryColor || "#c27b3d";
  const secondary = landing.secondaryColor || "#1f2937";
  const showHero = isModuleEnabled(landing.modules, "hero");

  const moduleSections: ReactNode[] = [];

  for (const id of sortedContentModules(landing.modules)) {
    switch (id) {
      case "upcomingEvents":
        moduleSections.push(
          <OrganizerEventsSection
            key="upcoming"
            title="Próximos eventos"
            events={landing.upcomingEvents}
            emptyMessage="No hay eventos públicos próximos por ahora."
            variant="upcoming"
          />
        );
        break;
      case "pastEvents":
        moduleSections.push(
          <OrganizerEventsSection
            key="past"
            title="Eventos realizados"
            events={landing.pastEvents}
            emptyMessage="Todavía no hay eventos anteriores publicados."
            variant="past"
          />
        );
        break;
      case "featuredGalleries":
        if (landing.featuredGalleries.length > 0) {
          moduleSections.push(
            <div key="featured" className="space-y-14 sm:space-y-16">
              <OrganizerFeaturedGalleriesSection items={landing.featuredGalleries} />
            </div>
          );
        }
        break;
      case "sponsors":
        if (landing.sponsors.length > 0) {
          moduleSections.push(
            <section key="sponsors" className="space-y-5 text-center ds-fill-width w-full min-w-0" aria-labelledby="org-sponsors-heading">
              <h2 id="org-sponsors-heading" className="text-2xl sm:text-3xl font-bold text-gray-900 m-0">
                Auspiciantes
              </h2>
              <p className="org-public-section-lead ds-readable-text ds-readable-text--fluid text-gray-600 m-0 text-sm sm:text-base mx-auto">
                Marcas y empresas que acompañan nuestros eventos.
              </p>
              <OrganizerSponsorsCarousel sponsors={landing.sponsors} />
            </section>
          );
        }
        break;
      case "officialPhotographers":
        if (landing.officialPhotographers.length > 0) {
          moduleSections.push(
            <OrganizerPhotographersSection
              key="official"
              title="Fotógrafos oficiales"
              subtitle="Fotógrafos que ya trabajaron en nuestros eventos."
              photographers={landing.officialPhotographers}
            />
          );
        }
        break;
      case "frequentPhotographers":
        if (landing.frequentPhotographers.length > 0) {
          moduleSections.push(
            <OrganizerPhotographersSection
              key="frequent"
              title="Fotógrafos frecuentes"
              subtitle="Profesionales que participan frecuentemente en nuestras coberturas."
              photographers={landing.frequentPhotographers}
            />
          );
        }
        break;
      case "photographerCall":
        moduleSections.push(
          <div key="call" className="ds-fill-width w-full min-w-0 pt-6 sm:pt-8 mt-2 border-t border-gray-200/80">
            <OrganizerPhotographerCallSection
              eventSlug={landing.photographerCallEventSlug}
              contactEmail={landing.publicEmail}
              whatsapp={landing.whatsapp}
            />
          </div>
        );
        break;
      default:
        break;
    }
  }

  return (
    <div
      className="org-public-landing min-h-screen bg-gray-50"
      style={
        {
          "--org-primary": primary,
          "--org-secondary": secondary,
        } as React.CSSProperties
      }
    >
      {showHero && (
        <header className="relative border-b border-gray-200 overflow-hidden">
          {landing.bannerUrl ? (
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${landing.bannerUrl})` }}
            />
          ) : null}
          <div
            className="absolute inset-0"
            style={{
              background: landing.bannerUrl
                ? `linear-gradient(135deg, ${primary}dd 0%, ${secondary}cc 100%)`
                : `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`,
            }}
          />
          <div className="relative container-custom py-14 sm:py-20 md:py-24">
            <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 items-start sm:items-center max-w-5xl min-w-0">
              {landing.logoUrl ? (
                <img
                  src={landing.logoUrl}
                  alt=""
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-contain bg-white/90 p-2 shadow-md flex-shrink-0"
                />
              ) : null}
              <div className="min-w-0 text-white">
                <h1 className="text-3xl sm:text-4xl font-bold m-0 mb-2 drop-shadow-sm">{landing.displayName}</h1>
                {landing.tagline ? (
                  <p className="text-lg text-white/95 m-0 mb-3 leading-relaxed max-w-2xl">
                    {landing.tagline}
                  </p>
                ) : null}
                {(landing.city || landing.zone) && (
                  <p className="text-sm text-white/85 m-0">
                    {[landing.city, landing.zone].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
            </div>
          </div>
        </header>
      )}

      <main className="container-custom py-12 sm:py-16 space-y-14 sm:space-y-20 max-w-6xl mx-auto min-w-0">
        {showHero && landing.description ? (
          <section className="ds-card rounded-2xl border border-gray-200 p-6 sm:p-8 bg-white">
            <p className="ds-readable-text ds-readable-text--fluid text-gray-700 m-0 whitespace-pre-wrap w-full">
              {landing.description}
            </p>
          </section>
        ) : null}

        {!showHero && (
          <section className="pt-4">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 m-0">{landing.displayName}</h1>
            {landing.tagline ? (
              <p className="org-public-section-lead ds-readable-text ds-readable-text--fluid text-gray-600 mt-2 m-0">
                {landing.tagline}
              </p>
            ) : null}
          </section>
        )}

        {moduleSections}

        {isModuleEnabled(landing.modules, "contact") && <OrganizerContactSection landing={landing} />}
      </main>

      <footer className="border-t border-gray-200 py-6 mt-8 bg-white">
        <p className="text-center text-xs text-gray-500 m-0">
          Powered by{" "}
          <a href="https://compramelafoto.com" className="text-[#c27b3d] underline">
            ComprameLaFoto
          </a>
        </p>
      </footer>
    </div>
  );
}