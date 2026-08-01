"use client";

import { useStoreCart } from "@/components/store/cart/StoreCartProvider";
import { cn } from "@/lib/cn";

type StoreCartButtonProps = {
  className?: string;
};

function CartIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      className={className}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.5 5h1.6l1.3 9.2a1.5 1.5 0 0 0 1.5 1.3h8.4a1.5 1.5 0 0 0 1.5-1.2L19.5 8H7"
      />
      <circle cx="9.5" cy="19" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="16.5" cy="19" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * Acceso al carrito en header — cantidad = suma de unidades.
 */
export function StoreCartButton({ className }: StoreCartButtonProps) {
  const { itemCount, openCart, hydrationState } = useStoreCart();
  const ready = hydrationState === "ready";
  const countLabel = ready ? String(itemCount) : "—";

  return (
    <button
      type="button"
      onClick={openCart}
      className={cn(
        "relative inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-[var(--ck-radius-control)] border-2 border-ck-border px-3 text-sm font-semibold text-ck-text transition-colors hover:border-ck-yellow hover:text-ck-yellow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ck-yellow",
        className,
      )}
      aria-label={
        ready
          ? `Abrir carrito, ${itemCount} ${itemCount === 1 ? "unidad" : "unidades"}`
          : "Abrir carrito"
      }
    >
      <CartIcon className="size-5" />
      <span
        className={cn("tabular-nums", !ready && "text-ck-text-muted")}
        data-testid="store-cart-count"
      >
        {countLabel}
      </span>
    </button>
  );
}
