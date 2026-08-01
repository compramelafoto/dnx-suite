import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import type { PublicStoreProductDetail } from "@/lib/public-store/types";

type StoreProductInfoProps = {
  product: Pick<
    PublicStoreProductDetail,
    "name" | "badge" | "priceLabel" | "shortDescription" | "description"
  >;
  /** Slot para selector / disponibilidad / CTA (isla cliente). */
  children?: ReactNode;
  className?: string;
};

/**
 * Bloque informativo estático de la ficha (Server Component).
 */
export function StoreProductInfo({
  product,
  children,
  className,
}: StoreProductInfoProps) {
  const fullDescription = product.description?.trim() || null;
  const short = product.shortDescription?.trim() || null;
  const showFullBlock =
    Boolean(fullDescription) &&
    (!short || fullDescription !== short);

  return (
    <div className={cn("space-y-8", className)}>
      <div className="space-y-4">
        <Badge variant="brand">{product.badge}</Badge>
        <h1 id="store-product-title" className="ck-display-md text-ck-text">
          {product.name}
        </h1>
        <p
          className="ck-heading-lg text-ck-yellow"
          aria-label={`Precio ${product.priceLabel}`}
        >
          {product.priceLabel}
        </p>
        {short ? (
          <p className="ck-body-lg text-ck-text-secondary">{short}</p>
        ) : null}
      </div>

      {children}

      {showFullBlock ? (
        <div className="space-y-3 border-t border-ck-border pt-8">
          <h2 className="ck-heading-md">Descripción</h2>
          <p className="ck-body-md whitespace-pre-line text-ck-text-secondary">
            {fullDescription}
          </p>
        </div>
      ) : null}
    </div>
  );
}
