import Link from "next/link";
import type { InfoSpotFeedItemDto } from "@/lib/feed/client";

function formatDate(iso: string | null | undefined) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(d);
}

/** Tarjeta del feed unificado — estilo editorial Info Spot. */
export function FeedItemCard({ item }: { item: InfoSpotFeedItemDto }) {
  const dateLabel = formatDate(item.publishedAt);
  const meta = [item.distanceLabel || item.locationLabel, dateLabel]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="group flex h-full flex-col">
      <Link href={item.publicUrl} className="flex h-full flex-col">
        <div className="relative overflow-hidden bg-[var(--is-graphite-100)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.imageUrl || "/editorial-stock/concert.jpg"}
            alt=""
            className="aspect-[16/11] w-full object-cover transition-[transform] duration-[var(--is-duration-300)] ease-[var(--is-ease-out)] group-hover:scale-[1.02]"
            loading="lazy"
          />
          {item.isFeatured ? (
            <span className="absolute left-3 top-3 bg-[var(--is-accent)] px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--is-graphite-950)]">
              Destacado
            </span>
          ) : null}
        </div>
        <div className="flex flex-1 flex-col gap-3 pt-5 md:gap-4 md:pt-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="is-label !text-[var(--is-accent)]">{item.typeLabel}</span>
            {item.statusLabel ? (
              <span className="text-xs text-[var(--is-graphite-600)]">{item.statusLabel}</span>
            ) : null}
          </div>
          <h3 className="is-h3 text-wrap break-words text-xl group-hover:text-[var(--is-accent)] md:text-2xl">
            {item.title}
          </h3>
          {item.excerpt ? (
            <p className="is-body is-line-clamp-3 text-[0.95rem]">{item.excerpt}</p>
          ) : null}
          {meta ? <p className="is-metadata mt-auto pt-1">{meta}</p> : null}
          <span className="text-sm font-medium text-[var(--is-accent)]">
            {item.type === "EVENT" || item.type === "PHOTOGRAPHER_CALL"
              ? "Ver evento"
              : "Leer más"}
          </span>
        </div>
      </Link>
    </article>
  );
}
