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
  }).format(new Date(date));
}

/** Listado compacto de próximos eventos. */
export function HomeUpcomingEvents({ events }: { events: DistributionEventCard[] }) {
  if (events.length === 0) return null;

  return (
    <section aria-labelledby="home-upcoming-heading">
      <div className="mb-8 flex flex-col gap-3 md:mb-10 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="is-eyebrow">Agenda</p>
          <h2 id="home-upcoming-heading" className="is-h2 mt-3 text-2xl md:text-3xl">
            Próximos eventos
          </h2>
        </div>
        <Link href="/eventos" className="is-btn is-btn-ghost min-h-11">
          Ver todos
        </Link>
      </div>
      <ul className="divide-y divide-[var(--is-border)] border-y border-[var(--is-border)]">
        {events.map((event) => (
          <li key={event.id}>
            <Link
              href={`/eventos/${event.slug}`}
              className="flex flex-col gap-1 py-5 transition-colors hover:bg-[var(--is-surface)] md:flex-row md:items-center md:justify-between md:gap-6 md:px-2"
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--is-accent)]">
                  {event.temporalLabel || formatWhen(event.startAt)}
                  {event.seekingPhotographers ? " · Buscando fotógrafos" : ""}
                </p>
                <h3 className="mt-1 text-lg font-semibold tracking-tight">{event.title}</h3>
              </div>
              <p className="text-sm text-[var(--is-muted)]">
                {event.locationLabel || `${event.city}, ${event.province}`}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
