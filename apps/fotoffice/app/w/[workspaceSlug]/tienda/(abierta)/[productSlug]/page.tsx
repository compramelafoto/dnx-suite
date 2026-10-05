import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { appUrl } from "@/lib/app-url";
import { STORE_PUBLIC_SEGMENT } from "@/lib/store/constants";
import { buildStoreProductJsonLd, serializeJsonLd } from "@/lib/store/product-json-ld";
import { getStoreProduct, loadOpenStore } from "@/lib/store/repository";
import { AddToCart } from "@/components/store/add-to-cart";
import { ProductGallery } from "@/components/store/product-gallery";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ workspaceSlug: string; productSlug: string }> };

async function cargar(workspaceSlug: string, productSlug: string) {
  const store = await loadOpenStore(workspaceSlug);
  if (!store) return null;
  const product = await getStoreProduct(store.workspace.id, productSlug);
  if (!product) return null;
  return { store, product };
}

function recortar(texto: string, max: number): string {
  const t = texto.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { workspaceSlug, productSlug } = await params;
  const datos = await cargar(workspaceSlug, productSlug);
  if (!datos) return {};
  const { store, product } = datos;
  const title = `${product.title} — ${store.workspace.name}`;
  const description = product.description ? recortar(product.description, 160) : `${product.title} en la tienda de ${store.workspace.name}.`;
  const imagen = product.images[0]?.url;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: store.workspace.name,
      locale: "es_AR",
      images: imagen ? [{ url: imagen }] : undefined,
    },
  };
}

/**
 * La ficha de un producto: galería, descripción, talles, cantidad y "Agregar al carrito".
 * 404 si no existe, no está a la venta online o está inactivo — sin distinguir cuál.
 */
export default async function StoreProductPage({ params }: Props) {
  const { workspaceSlug, productSlug } = await params;
  const datos = await cargar(workspaceSlug, productSlug);
  if (!datos) notFound();
  const { store, product } = datos;

  const base = `/w/${workspaceSlug}/${STORE_PUBLIC_SEGMENT}`;
  const jsonLd = buildStoreProductJsonLd(product, {
    brandName: store.workspace.name,
    url: `${appUrl().replace(/\/$/, "")}${base}/${product.slug}`,
  });

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 md:px-8 md:py-12">
      <script
        type="application/ld+json"
        // Lo arma el servidor desde la base; `serializeJsonLd` escapa `<` por los textos del negocio.
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <p>
        <Link href={base} className="text-sm underline underline-offset-4 opacity-70 hover:opacity-100">
          ← Volver a la tienda
        </Link>
      </p>

      <div className="grid gap-8 md:grid-cols-2 md:gap-12">
        <ProductGallery images={product.images} title={product.title} />

        <div className="min-w-0 space-y-6">
          <div className="space-y-2">
            {product.categoryName ? (
              <p className="text-xs uppercase tracking-wide text-[var(--fo-muted)]">{product.categoryName}</p>
            ) : null}
            <h1 className="text-2xl font-semibold tracking-tight break-words md:text-3xl">{product.title}</h1>
          </div>

          <AddToCart product={product} />

          {product.description ? (
            <div className="space-y-2 border-t border-[var(--fo-border)] pt-6">
              <h2 className="text-sm font-semibold">Descripción</h2>
              <p className="whitespace-pre-line break-words text-sm leading-relaxed text-[var(--fo-text-secondary)]">
                {product.description}
              </p>
            </div>
          ) : null}

          <div className="space-y-1 border-t border-[var(--fo-border)] pt-6 text-sm text-[var(--fo-muted)]">
            <p>
              <span className="font-medium text-[var(--fo-text)]">Retiro:</span> {store.settings.pickupAddress ?? "en el local"}
              {store.settings.pickupHours ? ` · ${store.settings.pickupHours}` : ""}
            </p>
            <p>Pagás online con Mercado Pago y retirás cuando te avisamos que está listo.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
