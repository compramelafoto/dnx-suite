import type { ReactNode } from "react";
import type { EventTemporalState } from "@/lib/distribution/temporal";

type Props = {
  temporalState: EventTemporalState;
  temporalLabel: string;
  /** UPCOMING / TODAY: inscripción + convocatoria */
  registrationHref?: string | null;
  joinHref?: string | null;
  seekingPhotographers?: boolean;
  /** FINISHED: álbumes / crónicas */
  children?: ReactNode;
};

/**
 * Prioriza CTAs según ciclo temporal del evento (no confundir con estado editorial).
 */
export function EventLifecycleSection({
  temporalState,
  temporalLabel,
  registrationHref,
  joinHref,
  seekingPhotographers,
  children,
}: Props) {
  const showRegistration =
    Boolean(registrationHref) &&
    (temporalState === "UPCOMING" ||
      temporalState === "TODAY" ||
      temporalState === "IN_PROGRESS");

  const showCall =
    Boolean(seekingPhotographers && joinHref) &&
    temporalState !== "FINISHED" &&
    temporalState !== "CANCELLED";

  return (
    <div className="space-y-6" data-testid="event-lifecycle-section" data-temporal={temporalState}>
      {temporalLabel ? (
        <p className="inline-flex rounded-full border border-[var(--is-border)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--is-accent)]">
          {temporalLabel}
        </p>
      ) : null}

      {showRegistration ? (
        <a
          href={registrationHref!}
          rel="noopener noreferrer"
          target="_blank"
          className="is-btn is-btn-solid h-11 w-full text-sm"
        >
          Inscribirme
        </a>
      ) : null}

      {showCall ? (
        <div className="border border-[var(--is-border)] p-5">
          <p className="is-eyebrow">¿Sos fotógrafo?</p>
          <p className="mt-3 text-sm text-[var(--is-text-secondary)]">
            Hay convocatoria abierta para cubrir este evento.
          </p>
          <a
            href={joinHref!}
            className="mt-4 inline-flex text-sm font-medium text-[var(--is-accent)] hover:underline"
            rel="noopener noreferrer"
          >
            Quiero cubrir este evento
          </a>
        </div>
      ) : null}

      {temporalState === "FINISHED" || temporalState === "IN_PROGRESS" ? children : null}
    </div>
  );
}
