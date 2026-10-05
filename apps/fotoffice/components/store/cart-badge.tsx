"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { STORE_PUBLIC_SEGMENT } from "@/lib/store/constants";
import { useCart } from "./cart-provider";

/** El acceso al carrito con la cantidad de unidades. Antes de leer el navegador no muestra número. */
export function CartBadge() {
  const { workspaceSlug, itemsCount, hydrated } = useCart();
  const etiqueta = hydrated && itemsCount > 0 ? `Carrito, ${itemsCount} ${itemsCount === 1 ? "unidad" : "unidades"}` : "Carrito";
  return (
    <Link
      href={`/w/${workspaceSlug}/${STORE_PUBLIC_SEGMENT}/carrito`}
      aria-label={etiqueta}
      className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--fo-border)] bg-[var(--fo-surface)] text-[var(--fo-text)] transition-colors hover:border-[var(--fo-border-strong)]"
    >
      <ShoppingBag className="h-5 w-5" aria-hidden />
      {hydrated && itemsCount > 0 ? (
        <span
          aria-hidden
          className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--fo-accent)] px-1.5 text-[11px] font-semibold leading-5 text-white tabular-nums"
        >
          {itemsCount > 99 ? "99+" : itemsCount}
        </span>
      ) : null}
    </Link>
  );
}
