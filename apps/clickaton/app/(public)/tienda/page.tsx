import type { Metadata } from "next";
import { SimpleBreadcrumb } from "@/components/content/SimpleBreadcrumb";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import {
  StoreEmptyState,
  StoreHeader,
  StoreProductGrid,
} from "@/components/store";
import { storePageContent } from "@/content/store";
import { routes } from "@/config/navigation";
import { listPublicStoreProducts } from "@/lib/public-store/list-store-products";
import { buildPageMetadata } from "@/lib/seo";

const content = storePageContent;

/** Listado de vitrina; alinear con maratones públicos. */
export const revalidate = 60;

const baseMeta = buildPageMetadata({
  title: content.meta.title,
  description: content.meta.description,
  path: routes.store,
});

export const metadata: Metadata = {
  ...baseMeta,
  title: {
    absolute: content.meta.absoluteTitle,
  },
  openGraph: {
    ...baseMeta.openGraph,
    title: content.meta.absoluteTitle,
  },
  twitter: {
    ...baseMeta.twitter,
    title: content.meta.absoluteTitle,
  },
};

export default async function StorePage() {
  const products = await listPublicStoreProducts();
  const hasProducts = products.length > 0;

  return (
    <>
      <SimpleBreadcrumb current="Tienda" />
      <StoreHeader />

      <Section tone="raised" aria-labelledby="store-catalog-title">
        <Container>
          <h2 id="store-catalog-title" className={hasProducts ? "ck-heading-lg" : "sr-only"}>
            {hasProducts ? content.catalogTitle : "Estado de la tienda"}
          </h2>
          {hasProducts ? (
            <>
              <p className="sr-only">
                {products.length}{" "}
                {products.length === 1 ? "producto disponible" : "productos disponibles"}
              </p>
              <StoreProductGrid products={products} />
            </>
          ) : (
            <div className="mt-4">
              <StoreEmptyState />
            </div>
          )}
        </Container>
      </Section>
    </>
  );
}
