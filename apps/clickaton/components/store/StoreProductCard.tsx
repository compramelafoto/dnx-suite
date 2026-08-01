import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FocusMark } from "@/components/ui/FocusMark";
import { storeProductPath } from "@/config/navigation";
import { storePageContent } from "@/content/store";
import type { StoreProductCardDto } from "@/lib/public-store/types";

type StoreProductCardProps = {
  product: StoreProductCardDto;
};

/**
 * Card pública de producto en TIENDA (sin compra).
 */
export function StoreProductCard({ product }: StoreProductCardProps) {
  const href = storeProductPath(product.storeSlug);
  const titleId = `store-product-${product.id}-title`;

  return (
    <Card
      as="article"
      variant="interactive"
      className="group flex h-full flex-col overflow-hidden p-0"
      aria-labelledby={titleId}
    >
      <Link
        href={href}
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ck-yellow focus-visible:ring-offset-2 focus-visible:ring-offset-ck-bg"
        aria-labelledby={titleId}
      >
        <div className="relative aspect-[4/5] w-full overflow-hidden border-b border-ck-border bg-ck-bg-alt">
          {product.primaryImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- URLs R2 /api/media sin remotePatterns next/image
            <img
              src={product.primaryImageUrl}
              alt={product.imageAlt}
              className="h-full w-full object-cover transition-transform duration-[var(--ck-duration-base)] group-hover:scale-[1.02]"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div
              className="flex h-full w-full flex-col items-center justify-center gap-3 text-ck-text-muted"
              role="img"
              aria-label={`Sin imagen de ${product.name}`}
            >
              <FocusMark size="lg" className="text-ck-yellow/40" />
              <span className="ck-label">Imagen próximamente</span>
            </div>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-4 p-6 sm:p-8">
        <Badge variant="brand">{storePageContent.badge}</Badge>

        <div className="space-y-3">
          <h3 id={titleId} className="ck-heading-md">
            <Link
              href={href}
              className="transition-colors duration-[var(--ck-duration-base)] hover:text-ck-yellow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ck-yellow focus-visible:ring-offset-2 focus-visible:ring-offset-ck-surface"
            >
              {product.name}
            </Link>
          </h3>
          {product.shortDescription ? (
            <p className="ck-body-sm text-ck-text-secondary">{product.shortDescription}</p>
          ) : null}
        </div>

        <p className="ck-heading-md mt-auto text-ck-yellow" aria-label={`Precio ${product.priceLabel}`}>
          {product.priceLabel}
        </p>

        <Button href={href} variant="secondary" className="w-full sm:w-auto">
          {storePageContent.cta}
        </Button>
      </div>
    </Card>
  );
}
