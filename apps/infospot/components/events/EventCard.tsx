import Link from "next/link";
import type { PublicEventCard } from "@/lib/events";
import { pickThematicStock } from "@/lib/editorial-stock";

function formatWhen(date: Date) {
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function EventCard({ event }: { event: PublicEventCard }) {
  const fallback = pickThematicStock(
    event.id,
    `${event.categorySlug || ""} ${event.title}`,
  );
  const image = event.coverImageUrl || fallback.src;

  return (
    <article className="group">
      <Link href={`/eventos/${event.slug}`} className="block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image}
          alt={event.title}
          className="aspect-[16/11] w-full object-cover transition-[transform] duration-300 group-hover:scale-[1.02]"
          loading="lazy"
          draggable={false}
        />
        <div className="mt-4 space-y-2">
          {event.categoryName ? (
            <p className="is-label">{event.categoryName}</p>
          ) : null}
          <h3 className="is-h3 text-lg group-hover:text-[var(--is-accent)] md:text-xl">
            {event.title}
          </h3>
          <p className="text-sm text-[var(--is-text-secondary)]">
            {formatWhen(event.startAt)}
            {typeof event.distanceKm === "number"
              ? ` · a ${event.distanceKm < 10 ? event.distanceKm.toFixed(1) : Math.round(event.distanceKm)} km`
              : ""}
          </p>
          <p className="text-sm text-[var(--is-muted)]">
            {event.city}, {event.province}
          </p>
        </div>
      </Link>
    </article>
  );
}
