import Link from "next/link";
import type { PublicEventCard } from "@/lib/events";

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

function EventCover({
  title,
  coverImageUrl,
  className,
}: {
  title: string;
  coverImageUrl: string | null;
  className: string;
}) {
  if (coverImageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={coverImageUrl}
        alt={title}
        className={className}
        loading="lazy"
        draggable={false}
      />
    );
  }
  return (
    <div
      className={`${className} bg-[linear-gradient(145deg,var(--is-graphite-800),var(--is-graphite-950))]`}
      aria-hidden
    />
  );
}

/** Eventos destacados — datos reales publicados (próximos primero). */
export function HomeFeaturedEvents({ events }: { events: PublicEventCard[] }) {
  if (events.length === 0) {
    return (
      <section id="eventos-destacados" aria-labelledby="home-events-heading">
        <div className="mb-10 max-w-2xl md:mb-12">
          <p className="is-eyebrow">Agenda viva</p>
          <h2
            id="home-events-heading"
            className="is-h2 mt-3 text-2xl md:text-3xl lg:text-4xl"
          >
            Eventos destacados
          </h2>
          <p className="is-body mt-3 max-w-xl">
            Todavía no hay eventos REAL próximos publicados. Cuando la redacción
            apruebe los primeros, van a aparecer acá.
          </p>
        </div>
        <div className="flex flex-wrap gap-4 border border-[var(--is-border)] bg-[var(--is-surface)] px-6 py-10 md:px-10">
          <div className="max-w-lg space-y-3">
            <p className="text-lg font-semibold tracking-[-0.02em] text-[var(--is-text)]">
              La agenda está por escribirse
            </p>
            <p className="text-sm leading-relaxed text-[var(--is-text-secondary)]">
              Si organizás algo, sumalo gratis. Si buscás qué hacer, volvé pronto.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href="/publicar-evento"
                className="is-btn is-btn-solid h-11 px-5 text-sm"
              >
                Publicar mi evento
              </Link>
              <Link
                href="/eventos"
                className="is-btn is-btn-secondary h-11 px-5 text-sm font-medium"
              >
                Descubrir eventos
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const [lead, ...rest] = events;

  return (
    <section id="eventos-destacados" aria-labelledby="home-events-heading">
      <div className="mb-10 flex flex-col gap-4 md:mb-12 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <p className="is-eyebrow">Agenda viva</p>
          <h2
            id="home-events-heading"
            className="is-h2 mt-3 text-2xl md:text-3xl lg:text-4xl"
          >
            Eventos destacados
          </h2>
          <p className="is-body mt-3 max-w-xl">
            Lo que se está moviendo cerca tuyo.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/eventos" className="is-btn is-btn-ghost min-h-11 self-start">
            Descubrir eventos
          </Link>
          <Link
            href="/publicar-evento"
            className="is-btn is-btn-solid min-h-11 px-5 text-sm"
          >
            Publicar mi evento
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-12 md:gap-5">
        {lead ? (
          <article className="group relative overflow-hidden md:col-span-7 md:min-h-[30rem]">
            <Link href={`/eventos/${lead.slug}`} className="absolute inset-0 z-10">
              <span className="sr-only">{lead.title}</span>
            </Link>
            <EventCover
              title={lead.title}
              coverImageUrl={lead.coverImageUrl}
              className="aspect-[4/5] w-full object-cover transition-[transform] duration-[var(--is-duration-300)] group-hover:scale-[1.03] md:absolute md:inset-0 md:aspect-auto md:h-full"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[color-mix(in_oklab,var(--is-graphite-950)_82%,transparent)] via-transparent to-transparent" />
            <div className="absolute inset-x-0 bottom-0 space-y-2 p-5 md:p-8">
              {lead.categoryName ? (
                <p className="is-label !text-[var(--is-orange-300)]">{lead.categoryName}</p>
              ) : (
                <p className="is-label !text-[var(--is-orange-300)]">
                  {formatWhen(lead.startAt)}
                </p>
              )}
              <h3 className="is-h3 text-xl text-[var(--is-white-0)] md:text-3xl">
                {lead.title}
              </h3>
              <p className="text-sm text-[color-mix(in_oklab,var(--is-white-0)_80%,transparent)]">
                {lead.city} · {formatWhen(lead.startAt)}
              </p>
            </div>
          </article>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 md:col-span-5 md:grid-cols-1">
          {rest.map((event) => (
            <article key={event.id} className="group relative overflow-hidden">
              <Link href={`/eventos/${event.slug}`} className="absolute inset-0 z-10">
                <span className="sr-only">{event.title}</span>
              </Link>
              <EventCover
                title={event.title}
                coverImageUrl={event.coverImageUrl}
                className="aspect-[16/11] w-full object-cover transition-[transform] duration-[var(--is-duration-300)] group-hover:scale-[1.03] md:min-h-[9.5rem]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[color-mix(in_oklab,var(--is-graphite-950)_75%,transparent)] to-transparent" />
              <div className="absolute inset-x-0 bottom-0 space-y-1 p-4 md:p-5">
                {event.categoryName ? (
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--is-orange-300)]">
                    {event.categoryName}
                  </p>
                ) : null}
                <h3 className="is-h4 text-base text-[var(--is-white-0)] md:text-lg">
                  {event.title}
                </h3>
                <p className="text-xs text-[color-mix(in_oklab,var(--is-white-0)_78%,transparent)]">
                  {event.city} · {formatWhen(event.startAt)}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
