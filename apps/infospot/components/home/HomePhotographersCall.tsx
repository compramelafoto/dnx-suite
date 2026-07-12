import Link from "next/link";
import type { DistributionEventCard } from "@/lib/distribution";

function formatWhen(date: Date) {
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(date);
}

/** Sección automática: eventos que buscan fotógrafos. */
export function HomePhotographersCall({
  events,
}: {
  events: DistributionEventCard[];
}) {
  if (events.length === 0) return null;

  return (
    <section aria-labelledby="home-photographers-heading">
      <div className="mb-10 max-w-2xl md:mb-12">
        <p className="is-eyebrow">Coberturas abiertas</p>
        <h2
          id="home-photographers-heading"
          className="is-h2 mt-3 text-2xl md:text-3xl lg:text-4xl"
        >
          Estos eventos están buscando fotógrafos
        </h2>
        <p className="is-body mt-3">
          La inscripción se gestiona en ComprameLaFoto. Cuando se cierra el cupo o
          la convocatoria, el evento sale solo de esta lista.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {events.map((event) => (
          <article key={event.id} className="group flex flex-col">
            <Link href={`/eventos/${event.slug}`} className="block">
              {event.coverImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={event.coverImageUrl}
                  alt={event.title}
                  className="aspect-[4/5] w-full object-cover transition-[transform] duration-[var(--is-duration-300)] group-hover:scale-[1.02]"
                  loading="lazy"
                  draggable={false}
                />
              ) : (
                <div
                  className="aspect-[4/5] w-full bg-[linear-gradient(145deg,var(--is-graphite-800),var(--is-graphite-950))]"
                  aria-hidden
                />
              )}
            </Link>
            <div className="mt-4 flex flex-1 flex-col space-y-2">
              <p className="is-label">
                {event.slotsLabel || event.temporalLabel || "Convocatoria"}
              </p>
              <h3 className="is-h4 text-lg">
                <Link href={`/eventos/${event.slug}`} className="hover:text-[var(--is-accent)]">
                  {event.title}
                </Link>
              </h3>
              <p className="text-sm text-[var(--is-text-secondary)]">
                {event.locationLabel} · {formatWhen(event.startAt)}
              </p>
              {event.clfJoinUrl ? (
                <a
                  href={`/api/r?to=${encodeURIComponent(event.clfJoinUrl)}&kind=CLF_REGISTRATION_CLICK&eventId=${encodeURIComponent(event.id)}`}
                  className="is-btn is-btn-solid mt-auto h-10 w-fit px-4 text-sm"
                >
                  Inscribirme como fotógrafo
                </a>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
