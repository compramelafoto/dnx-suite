"use client";

import Link from "next/link";
import AlbumListCoverMedia from "@/components/album/AlbumListCoverMedia";
import type { OrganizerPublicFeaturedGallery } from "@/lib/organizer-public-landing-server";

function formatFeaturedDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleString("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

type FeaturedGalleryCardProps = {
  item: OrganizerPublicFeaturedGallery;
  variant: "featured" | "comingSoon";
  layoutClassName?: string;
};

export default function OrganizerFeaturedGalleryCard({
  item,
  variant,
  layoutClassName = "",
}: FeaturedGalleryCardProps) {
  const eventDate = formatFeaturedDate(item.startsAt);

  if (variant === "comingSoon") {
    return (
      <article
        className={`ds-card rounded-2xl overflow-hidden border border-dashed border-gray-300 bg-white shadow-sm flex flex-col min-h-[220px] ${layoutClassName}`}
      >
        <div className="relative aspect-[16/10] bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden">
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
            <span className="inline-flex items-center rounded-full bg-[var(--org-primary,#c27b3d)]/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--org-primary,#c27b3d)]">
              Próximamente
            </span>
            <p className="text-xs text-gray-500 m-0 max-w-[16rem] leading-relaxed">
              Las fotos se publicarán cuando estén listas.
            </p>
          </div>
        </div>
        <div className="p-5 flex flex-col gap-2 flex-1">
          <p className="text-xs uppercase tracking-wide text-gray-500 m-0">
            {item.kind === "event" ? "Evento" : "Galería"}
          </p>
          <h3 className="text-lg font-semibold text-gray-900 m-0 line-clamp-2">{item.title}</h3>
          {item.subtitle ? (
            <p className="text-sm text-gray-600 m-0 line-clamp-1">{item.subtitle}</p>
          ) : null}
          {eventDate ? <p className="text-xs text-gray-500 m-0">{eventDate}</p> : null}
          <div className="flex flex-wrap gap-2 mt-auto pt-3">
            {item.galleryUrl ? (
              <Link
                href={`${item.galleryUrl}#interesado`}
                className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-sm font-medium text-white whitespace-nowrap"
                style={{ backgroundColor: "var(--org-primary, #c27b3d)" }}
              >
                Anotarme como interesado
              </Link>
            ) : null}
            {item.eventUrl ? (
              <Link
                href={item.eventUrl}
                className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-sm font-medium border border-gray-300 text-gray-800 bg-white whitespace-nowrap hover:bg-gray-50"
              >
                Ver evento
              </Link>
            ) : null}
          </div>
        </div>
      </article>
    );
  }

  const cardInner = (
    <>
      <div className="absolute inset-0">
        <AlbumListCoverMedia
          title={item.title}
          coverPhotoUrl={item.coverUrl}
          coverPhotoUrlFallback={item.coverUrlFallback}
          photosCount={item.photosCount}
          variant="minimal"
          className="w-full h-full"
          imageClassName="object-cover group-hover:scale-[1.03] transition-transform duration-500"
          comingSoonClassName="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300"
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent pointer-events-none" />
      <div className="relative h-full min-h-[220px] flex flex-col justify-end p-5 sm:p-6 text-white pointer-events-none">
        <p className="text-xs uppercase tracking-wide text-white/80 m-0 mb-1">
          {item.kind === "event" ? "Evento" : "Galería"}
        </p>
        <h3 className="text-xl font-bold m-0 mb-1 line-clamp-2">{item.title}</h3>
        {item.subtitle ? (
          <p className="text-sm text-white/90 m-0 mb-4 line-clamp-1">{item.subtitle}</p>
        ) : (
          <div className="mb-4" />
        )}
        {item.galleryUrl ? (
          <span className="inline-flex w-fit items-center justify-center px-4 py-2.5 rounded-lg text-sm font-semibold bg-white text-gray-900 whitespace-nowrap group-hover:bg-gray-100 transition-colors">
            Ver galería
          </span>
        ) : null}
      </div>
    </>
  );

  const cardClassName = `ds-card relative rounded-2xl overflow-hidden border border-gray-200 shadow-sm group min-h-[220px] ${layoutClassName}`;

  if (item.galleryUrl) {
    return (
      <Link
        href={item.galleryUrl}
        className={`${cardClassName} block cursor-pointer hover:shadow-md transition-shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--org-primary,#c27b3d)]`}
        aria-label={`Ver galería: ${item.title}`}
      >
        {cardInner}
      </Link>
    );
  }

  return <article className={cardClassName}>{cardInner}</article>;
}
