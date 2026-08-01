"use client";

import { useEffect, useMemo, useState } from "react";
import { useStoreCart } from "@/components/store/cart/StoreCartProvider";
import { StoreCartQuantity } from "@/components/store/cart/StoreCartQuantity";
import { Button } from "@/components/ui/Button";
import {
  availabilityFromStock,
  type StoreAvailabilityView,
} from "@/lib/public-store/availability";
import { maxStoreCartQuantity } from "@/lib/public-store/cart";
import type { PublicStoreVariant } from "@/lib/public-store/types";
import { cn } from "@/lib/cn";

type StoreAddToCartPanelProps = {
  productId: string;
  productName: string;
  productAvailability: StoreAvailabilityView;
  variants: PublicStoreVariant[];
  selectedVariantId: string | null;
  className?: string;
};

/**
 * Cantidad + CTA “Agregar al carrito” (sin checkout).
 */
export function StoreAddToCartPanel({
  productId,
  productName,
  productAvailability,
  variants,
  selectedVariantId,
  className,
}: StoreAddToCartPanelProps) {
  const { addItem, hydrationState } = useStoreCart();
  const requiresVariant = variants.length > 0;
  const selected = useMemo(
    () => variants.find((v) => v.id === selectedVariantId) ?? null,
    [variants, selectedVariantId],
  );

  const stock = selected?.availableStock ?? 0;
  const maxQty = selected ? maxStoreCartQuantity(stock) : 0;
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    setQuantity(1);
  }, [selectedVariantId]);

  useEffect(() => {
    if (maxQty > 0 && quantity > maxQty) setQuantity(maxQty);
  }, [maxQty, quantity]);

  const productSoldOut =
    productAvailability.kind === "sold_out" ||
    (requiresVariant && variants.every((v) => !v.selectable));

  const canAdd =
    hydrationState === "ready" &&
    !productSoldOut &&
    (!requiresVariant || (selected != null && selected.selectable)) &&
    maxQty >= 1 &&
    quantity >= 1 &&
    quantity <= maxQty;

  const hint = (() => {
    if (hydrationState !== "ready") return "Cargando carrito…";
    if (productSoldOut) return "Producto agotado.";
    if (requiresVariant && !selected) return "Elegí una opción para continuar.";
    if (selected && !selected.selectable) return "Esta opción está agotada.";
    if (selected) {
      const a = availabilityFromStock(selected.availableStock);
      if (a.kind === "low_stock") return `${a.label} · máximo ${maxQty}.`;
    }
    return "Los productos no quedan reservados hasta confirmar la compra.";
  })();

  return (
    <div className={cn("space-y-4", className)} data-store-add-to-cart="ready">
      {selected && selected.selectable ? (
        <StoreCartQuantity
          id={`qty-${productId}`}
          value={quantity}
          max={maxQty}
          onChange={setQuantity}
          label={`Cantidad de ${productName}`}
        />
      ) : null}

      <Button
        type="button"
        variant="primary"
        size="lg"
        disabled={!canAdd}
        aria-disabled={!canAdd}
        className="w-full sm:w-auto"
        data-testid="store-add-to-cart"
        onClick={() => {
          if (!canAdd || !selected) return;
          addItem({
            productId,
            variantId: selected.id,
            quantity,
            availableStock: selected.availableStock,
            productLabel: productName,
            variantLabel: selected.name,
          });
        }}
      >
        Agregar al carrito
      </Button>
      <p className="ck-body-sm text-ck-text-muted">{hint}</p>
    </div>
  );
}
