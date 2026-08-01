"use client";

import { useMemo, useState } from "react";
import { StoreAddToCartPanel } from "@/components/store/cart/StoreAddToCartPanel";
import { StoreAvailability } from "@/components/store/StoreAvailability";
import { StoreVariantSelector } from "@/components/store/StoreVariantSelector";
import {
  availabilityFromStock,
  type StoreAvailabilityView,
} from "@/lib/public-store/availability";
import type { PublicStoreVariant } from "@/lib/public-store/types";

type StoreProductOptionsPanelProps = {
  productId: string;
  productName: string;
  variants: PublicStoreVariant[];
  productAvailability: StoreAvailabilityView;
  initialSelectedVariantId: string | null;
  className?: string;
};

/**
 * Isla cliente: variantes + disponibilidad + agregar al carrito.
 */
export function StoreProductOptionsPanel({
  productId,
  productName,
  variants,
  productAvailability,
  initialSelectedVariantId,
  className,
}: StoreProductOptionsPanelProps) {
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    initialSelectedVariantId,
  );

  const selected = useMemo(
    () => variants.find((v) => v.id === selectedVariantId) ?? null,
    [variants, selectedVariantId],
  );

  const availability: StoreAvailabilityView = selected
    ? availabilityFromStock(selected.availableStock)
    : productAvailability;

  return (
    <div className={className}>
      <StoreVariantSelector
        variants={variants}
        selectedVariantId={selectedVariantId}
        onSelect={setSelectedVariantId}
      />
      <div className={variants.length > 0 ? "mt-8" : undefined}>
        <StoreAvailability availability={availability} />
      </div>
      <div className="mt-8">
        <StoreAddToCartPanel
          productId={productId}
          productName={productName}
          productAvailability={productAvailability}
          variants={variants}
          selectedVariantId={selectedVariantId}
        />
      </div>
    </div>
  );
}
