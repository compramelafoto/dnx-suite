import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SimpleBreadcrumb } from "@/components/content/SimpleBreadcrumb";
import {
  StoreProductDetailView,
  StoreRelatedProducts,
} from "@/components/store";
import { routes, storeProductPath } from "@/config/navigation";
import {
  getPublicStoreProductBySlug,
  listRelatedStoreProducts,
} from "@/lib/public-store/get-store-product";
import { buildStoreProductJsonLd } from "@/lib/public-store/product-json-ld";
import { buildPageMetadata } from "@/lib/seo";

type PageProps = {
  params: Promise<{ storeSlug: string }>;
};

/** Alineado al listado `/tienda`. */
export const revalidate = 60;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { storeSlug } = await params;
  const product = await getPublicStoreProductBySlug(decodeURIComponent(storeSlug));
  if (!product) notFound();

  const description =
    product.shortDescription ??
    `Producto oficial Clickatón: ${product.name}.`;

  const base = buildPageMetadata({
    title: product.name,
    description,
    path: storeProductPath(product.slug),
    image: product.primaryImage?.url ?? null,
    imageAlt: product.primaryImage?.alt ?? product.name,
  });

  const absoluteTitle = `${product.name} | Tienda Clickatón`;

  return {
    ...base,
    title: { absolute: absoluteTitle },
    openGraph: {
      ...base.openGraph,
      title: absoluteTitle,
      type: "website",
    },
    twitter: {
      ...base.twitter,
      title: absoluteTitle,
    },
  };
}

export default async function StoreProductDetailPage({ params }: PageProps) {
  const { storeSlug } = await params;
  const product = await getPublicStoreProductBySlug(decodeURIComponent(storeSlug));
  if (!product) notFound();

  const related = await listRelatedStoreProducts({
    productId: product.id,
    editionId: product.editionId,
    limit: 4,
  });

  const jsonLd = buildStoreProductJsonLd(product);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SimpleBreadcrumb
        items={[
          { label: "Inicio", href: routes.home },
          { label: "Tienda", href: routes.store },
          { label: product.name },
        ]}
      />
      <StoreProductDetailView product={product} />
      <StoreRelatedProducts products={related} />
    </>
  );
}
