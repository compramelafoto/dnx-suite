import Link from "next/link";
import type { PublicArtworkCard } from "@/lib/store/artworks/storefront";
import { Price } from "./price";

/**
 * La grilla de obras: dos columnas en el teléfono, tres en tableta, cuatro en escritorio. La foto
 * se ve completa (sin recortar: es una obra), sobre un fondo neutro.
 */
export function ArtworkGrid({ artworks, basePath }: { artworks: PublicArtworkCard[]; basePath: string }) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
      {artworks.map((a) => (
        <li key={a.listingId} className="min-w-0">
          <ArtworkCard artwork={a} href={`${basePath}/${a.slug}`} />
        </li>
      ))}
    </ul>
  );
}

function ArtworkCard({ artwork, href }: { artwork: PublicArtworkCard; href: string }) {
  return (
    <Link href={href} className="group flex min-w-0 flex-col gap-3 rounded-[var(--fo-radius)] focus-visible:outline-2 focus-visible:outline-offset-4">
      <div
        className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-[var(--fo-radius)] border border-[var(--fo-border)] p-2"
        style={{ backgroundColor: "color-mix(in srgb, var(--fo-text) 5%, transparent)" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={artwork.imageUrl}
          alt={artwork.title}
          width={artwork.previewWidth}
          height={artwork.previewHeight}
          loading="lazy"
          className="max-h-full max-w-full object-contain transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
        {artwork.awardLabel ? (
          <span className="absolute left-2 top-2 max-w-[calc(100%-1rem)] truncate rounded-full bg-black/75 px-2.5 py-1 text-xs font-medium text-white">
            {artwork.awardLabel}
          </span>
        ) : null}
      </div>
      <div className="min-w-0 space-y-1">
        <p className="truncate text-xs uppercase tracking-wide text-[var(--fo-muted)]">{artwork.contestTitle}</p>
        <h2 className="line-clamp-2 text-sm font-medium leading-snug group-hover:underline group-hover:underline-offset-4">
          {artwork.title}
        </h2>
        {artwork.authorDisplayName ? (
          <p className="truncate text-xs text-[var(--fo-muted)]">{artwork.authorDisplayName}</p>
        ) : null}
        <Price minor={artwork.fromPriceMinor} from={artwork.formatsCount > 1} className="text-sm font-semibold" />
      </div>
    </Link>
  );
}
