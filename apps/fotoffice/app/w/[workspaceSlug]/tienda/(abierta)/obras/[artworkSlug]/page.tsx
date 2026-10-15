import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { STORE_PUBLIC_SEGMENT } from "@/lib/store/constants";
import { loadOpenStore } from "@/lib/store/repository";
import { getPublicArtwork } from "@/lib/store/artworks/storefront";
import { ArtworkAddToCart } from "@/components/store/artwork-add-to-cart";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ workspaceSlug: string; artworkSlug: string }> };

async function cargar(workspaceSlug: string, artworkSlug: string) {
  const store = await loadOpenStore(workspaceSlug);
  if (!store) return null;
  const artwork = await getPublicArtwork(store.workspace.id, artworkSlug);
  if (!artwork) return null;
  return { store, artwork };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { workspaceSlug, artworkSlug } = await params;
  const datos = await cargar(workspaceSlug, artworkSlug);
  if (!datos) return {};
  const { store, artwork } = datos;
  const title = `${artwork.title} — ${store.workspace.name}`;
  const description = [
    `Copia impresa de "${artwork.title}"`,
    artwork.authorDisplayName ? `de ${artwork.authorDisplayName}` : null,
    `(${artwork.contestTitle}).`,
  ]
    .filter(Boolean)
    .join(" ");
  return {
    title,
    description,
    openGraph: { title, description, siteName: store.workspace.name, locale: "es_AR", images: [{ url: artwork.imageUrl }] },
  };
}

/**
 * La ficha de una obra: vista previa grande (con marca de agua, guardada en el R2 de FOTOFFICE),
 * título, autor (si corresponde darle crédito), concurso, premio, formatos que su resolución
 * alcanza con precio y medidas, aviso de bordes y "Agregar al carrito". 404 si no existe o no se
 * puede vender hoy — sin distinguir por qué.
 */
export default async function StoreArtworkPage({ params }: Props) {
  const { workspaceSlug, artworkSlug } = await params;
  const datos = await cargar(workspaceSlug, artworkSlug);
  if (!datos) notFound();
  const { store, artwork } = datos;
  const base = `/w/${workspaceSlug}/${STORE_PUBLIC_SEGMENT}/obras`;

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 md:px-8 md:py-12">
      <p>
        <Link href={base} className="text-sm underline underline-offset-4 opacity-70 hover:opacity-100">
          ← Volver a las obras
        </Link>
      </p>

      <div className="grid gap-8 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] md:gap-12">
        <div
          className="flex items-center justify-center overflow-hidden rounded-[var(--fo-radius)] border border-[var(--fo-border)] p-3 md:p-6"
          style={{ backgroundColor: "color-mix(in srgb, var(--fo-text) 5%, transparent)" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={artwork.imageUrl}
            alt={artwork.title}
            width={artwork.previewWidth}
            height={artwork.previewHeight}
            className="h-auto max-h-[75vh] w-auto max-w-full object-contain"
          />
        </div>

        <div className="min-w-0 space-y-6">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-[var(--fo-muted)]">{artwork.contestTitle}</p>
            <h1 className="text-2xl font-semibold tracking-tight break-words md:text-3xl">{artwork.title}</h1>
            {artwork.authorDisplayName ? (
              <p className="text-sm text-[var(--fo-text-secondary)]">
                Autor: <span className="font-medium text-[var(--fo-text)]">{artwork.authorDisplayName}</span>
              </p>
            ) : null}
            {artwork.awardLabel ? (
              <p>
                <span className="inline-flex rounded-full border border-[var(--fo-border-strong)] px-3 py-1 text-xs font-medium">
                  {artwork.awardLabel}
                </span>
              </p>
            ) : null}
          </div>

          <ArtworkAddToCart artwork={artwork} />

          <div className="space-y-1 border-t border-[var(--fo-border)] pt-6 text-sm text-[var(--fo-muted)]">
            <p>La imagen de muestra lleva marca de agua; la copia se imprime sin ella, desde el archivo original.</p>
            <p>
              <span className="font-medium text-[var(--fo-text)]">Retiro:</span> {store.settings.pickupAddress ?? "en el local"}
              {store.settings.pickupHours ? ` · ${store.settings.pickupHours}` : ""}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
