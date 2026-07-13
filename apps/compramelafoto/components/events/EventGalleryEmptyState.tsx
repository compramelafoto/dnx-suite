import type { EventGalleryPublicState } from "@/lib/events/resolve-event-gallery-public-state";
import EventNotifyForm from "@/app/g/[shareSlug]/EventNotifyForm";
import EventGalleryReactivationRequestForm from "@/components/events/EventGalleryReactivationRequestForm";

export type EventGalleryEmptyStateProps = {
  state: Exclude<EventGalleryPublicState, "AVAILABLE">;
  shareSlug: string;
  reactivatableCount?: number;
};

type EmptyStateVisual = "upcoming" | "expired" | "removed" | "deleted" | "configuring";

function visualForState(state: EventGalleryEmptyStateProps["state"]): EmptyStateVisual {
  switch (state) {
    case "EXPIRED_REACTIVABLE":
      return "expired";
    case "ONLY_REMOVED_PHOTOS":
      return "removed";
    case "DELETED_FINAL":
      return "deleted";
    case "INCOMPLETE_ALBUM_CONFIG":
      return "configuring";
    default:
      return "upcoming";
  }
}

function copyForState(state: EventGalleryEmptyStateProps["state"]): {
  title: string;
  description: string;
} {
  switch (state) {
    case "EMPTY_NEW":
      return {
        title: "Las fotos se subirán pronto",
        description:
          "Los fotógrafos todavía no publicaron fotografías de este evento. Volvé a ingresar más adelante.",
      };
    case "EXPIRED_REACTIVABLE":
      return {
        title: "Las fotos de este evento ya no están disponibles",
        description:
          "Las galerías fueron ocultadas automáticamente luego del período de disponibilidad. Podés reactivarlas para volver a ver y comprar las fotos.",
      };
    case "ONLY_REMOVED_PHOTOS":
      return {
        title: "Las fotografías ya no se encuentran disponibles",
        description:
          "Las imágenes de este evento fueron removidas y actualmente no pueden visualizarse.",
      };
    case "DELETED_FINAL":
      return {
        title: "Las fotografías de este evento ya no están disponibles",
        description:
          "El período de disponibilidad finalizó y las fotografías fueron eliminadas definitivamente.",
      };
    case "INCOMPLETE_ALBUM_CONFIG":
      return {
        title: "Las galerías todavía no están disponibles",
        description:
          "Los fotógrafos aún están terminando de configurar las galerías de este evento.",
      };
  }
}

function StateIcon({ visual }: { visual: EmptyStateVisual }) {
  const iconClass = "w-8 h-8";
  switch (visual) {
    case "expired":
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M12 7v5l3 2"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "removed":
    case "deleted":
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" aria-hidden>
          <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M8 5l1-2h6l1 2M9 14l2-2 2 2 2-2"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "configuring":
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    default:
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M4 16l4-5 4 3 4-6 4 8"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
  }
}

const VISUAL_STYLES: Record<
  EmptyStateVisual,
  { shell: string; iconWrap: string; iconColor: string }
> = {
  upcoming: {
    shell: "border-gray-200 bg-white shadow-sm",
    iconWrap: "bg-[#c27b3d]/10 text-[#c27b3d]",
    iconColor: "text-[#c27b3d]",
  },
  expired: {
    shell: "border-amber-200 bg-gradient-to-b from-amber-50 to-white shadow-md ring-1 ring-amber-100/80",
    iconWrap: "bg-amber-100 text-amber-800",
    iconColor: "text-amber-800",
  },
  removed: {
    shell: "border-gray-200 bg-gray-50/80 shadow-sm",
    iconWrap: "bg-gray-100 text-gray-600",
    iconColor: "text-gray-600",
  },
  deleted: {
    shell: "border-gray-200 bg-gray-50/80 shadow-sm",
    iconWrap: "bg-gray-100 text-gray-600",
    iconColor: "text-gray-600",
  },
  configuring: {
    shell: "border-sky-100 bg-gradient-to-b from-sky-50/90 to-white shadow-sm",
    iconWrap: "bg-sky-100 text-sky-800",
    iconColor: "text-sky-800",
  },
};

export default function EventGalleryEmptyState({
  state,
  shareSlug,
  reactivatableCount = 0,
}: EventGalleryEmptyStateProps) {
  const visual = visualForState(state);
  const styles = VISUAL_STYLES[visual];
  const { title, description } = copyForState(state);
  const showReactivation = state === "EXPIRED_REACTIVABLE";
  const showNotify = state === "EMPTY_NEW";

  return (
    <section
      className="ds-gallery-empty-state event-gallery-empty-state mt-6 sm:mt-8"
      role="status"
      aria-live="polite"
    >
      <div className={`ds-gallery-empty-state__panel rounded-2xl border p-6 sm:p-8 md:p-10 shadow-sm ${styles.shell}`}>
        <div className="ds-gallery-empty-state__stack">
          <div
            className={`ds-gallery-empty-state__icon flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-2xl ${styles.iconWrap}`}
          >
            <StateIcon visual={visual} />
          </div>

          <div className="ds-gallery-empty-state__copy space-y-2 sm:space-y-3">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-semibold text-gray-900 text-pretty leading-tight m-0 w-full">
              {title}
            </h2>
            <p className="ds-readable-text ds-readable-text--fluid text-base sm:text-lg text-gray-600 m-0 leading-relaxed w-full">
              {description}
            </p>
          </div>

          {showReactivation ? (
            <div className="ds-gallery-empty-state__actions">
              <EventGalleryReactivationRequestForm
                shareSlug={shareSlug}
                reactivatableCount={reactivatableCount}
              />
            </div>
          ) : null}

          {showNotify ? (
            <div
              id="interesado"
              className="ds-gallery-empty-state__actions ds-gallery-empty-state__notify scroll-mt-24"
            >
              <p className="ds-readable-text ds-readable-text--fluid ds-readable-text--center text-sm text-gray-500 m-0 w-full">
                Dejanos tus datos y te avisamos cuando la galería esté lista para ver y comprar.
              </p>
              <EventNotifyForm shareSlug={shareSlug} />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
