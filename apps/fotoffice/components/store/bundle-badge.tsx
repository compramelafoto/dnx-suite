"use client";

import { useCart } from "./cart-provider";

/**
 * "Llevá 2 por $60.000": la promo de la tienda, sólo en los productos que entran. Lee la promo
 * del carrito (la carga el layout de la tienda); fuera de un producto de la promo no dibuja nada.
 */
export function BundleBadge({ productId, size = "sm" }: { productId: string; size?: "sm" | "md" }) {
  const { bundle } = useCart();
  if (!bundle || !bundle.productIds.includes(productId)) return null;
  return (
    <span
      className={
        "inline-flex w-fit items-center rounded-full border border-[var(--fo-success-border)] bg-[var(--fo-success-soft)] font-medium text-[var(--fo-success)] " +
        (size === "md" ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-xs")
      }
    >
      {bundle.label}
    </span>
  );
}
