"use client";

import Link from "next/link";
import { Minus, Plus, Trash2 } from "lucide-react";
import { lineKey } from "@/lib/store/cart";
import { STORE_PUBLIC_SEGMENT } from "@/lib/store/constants";
import { useCart } from "./cart-provider";
import { useCartRevalidation } from "./use-cart-revalidation";
import { Price } from "./price";

/**
 * El carrito: líneas con cantidad editable, avisos de lo que cambió, total y "Finalizar compra".
 *
 * Cada vez que el carrito cambia se revalida en el servidor (`useCartRevalidation`), que deja las
 * líneas comprables con precio y nombre actuales y los avisos de lo que cambió.
 */
export function CartView({
  pickupAddress,
  shippingAvailable,
}: {
  pickupAddress: string | null;
  /** La institución ofrece algún envío: el costo se ve recién en el checkout. */
  shippingAvailable: boolean;
}) {
  const cart = useCart();
  const { workspaceSlug, state, hydrated } = cart;
  const { problems, maxPorLinea, validando, error } = useCartRevalidation();
  const base = `/w/${workspaceSlug}/${STORE_PUBLIC_SEGMENT}`;

  if (!hydrated) {
    return <p className="text-sm text-[var(--fo-muted)]">Cargando el carrito…</p>;
  }

  const avisos = problems.length > 0 || error ? (
    <div className="fo-card space-y-1 p-4 text-sm" role="status">
      {error ? <p className="text-[var(--fo-danger)]">{error}</p> : null}
      {problems.length > 0 ? (
        <>
          <p className="font-medium">Actualizamos tu carrito:</p>
          <ul className="list-disc space-y-1 pl-5 text-[var(--fo-muted)]">
            {problems.map((p, i) => (
              <li key={`${p.key}-${i}`}>{p.message}</li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  ) : null;

  if (state.lines.length === 0) {
    return (
      <div className="space-y-6">
        {avisos}
        <div className="fo-card space-y-4 p-6 text-center">
          <p className="text-sm text-[var(--fo-muted)]">Tu carrito está vacío.</p>
          <Link href={base} className="fo-btn fo-btn-primary">
            Ver productos
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {avisos}

      <ul className="divide-y divide-[var(--fo-border)] border-y border-[var(--fo-border)]">
        {state.lines.map((l) => {
          const key = lineKey(l);
          const max = maxPorLinea[key] ?? 99;
          return (
            <li key={key} className="flex gap-3 py-4 sm:gap-4">
              <Link
                href={`${base}/${l.slug}`}
                className="h-20 w-20 shrink-0 overflow-hidden rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)]"
                style={{ backgroundColor: "color-mix(in srgb, var(--fo-text) 5%, transparent)" }}
              >
                {l.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={l.imageUrl} alt={l.name} className="h-full w-full object-cover" />
                ) : null}
              </Link>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`${base}/${l.slug}`} className="line-clamp-2 text-sm font-medium hover:underline">
                      {l.name}
                    </Link>
                    {l.variantName ? <p className="text-xs text-[var(--fo-muted)]">Talle {l.variantName}</p> : null}
                    <Price minor={l.unitPriceMinor} className="text-xs text-[var(--fo-muted)]" />
                  </div>
                  <Price minor={l.unitPriceMinor * l.qty} className="shrink-0 text-sm font-semibold" />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div
                    className="inline-flex items-center rounded-[var(--fo-radius-sm)] border border-[var(--fo-border-strong)]"
                    role="group"
                    aria-label={`Cantidad de ${l.name}`}
                  >
                    <button
                      type="button"
                      onClick={() => cart.setQty(key, l.qty - 1)}
                      disabled={l.qty <= 1}
                      aria-label="Una menos"
                      className="inline-flex h-10 w-10 items-center justify-center disabled:opacity-40"
                    >
                      <Minus className="h-4 w-4" aria-hidden />
                    </button>
                    <span className="min-w-7 text-center text-sm tabular-nums">{l.qty}</span>
                    <button
                      type="button"
                      onClick={() => cart.setQty(key, Math.min(max, l.qty + 1))}
                      disabled={l.qty >= max}
                      aria-label="Una más"
                      className="inline-flex h-10 w-10 items-center justify-center disabled:opacity-40"
                    >
                      <Plus className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => cart.remove(key)}
                    className="inline-flex items-center gap-1 text-xs text-[var(--fo-muted)] hover:text-[var(--fo-danger)]"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                    Quitar
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="fo-card space-y-4 p-5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm text-[var(--fo-muted)]">
            Total ({cart.itemsCount} {cart.itemsCount === 1 ? "unidad" : "unidades"})
          </span>
          <Price minor={cart.subtotalMinor} className="text-xl font-semibold" />
        </div>
        {shippingAvailable ? (
          <p className="text-xs text-[var(--fo-muted)]">El envío se calcula en el siguiente paso.</p>
        ) : pickupAddress ? (
          <p className="text-xs text-[var(--fo-muted)]">Retirás en {pickupAddress}. Sin costo de envío.</p>
        ) : null}
        {validando || error ? (
          <span className="fo-btn fo-btn-primary w-full opacity-45" aria-disabled="true">
            {validando ? "Revisando el carrito…" : "Finalizar compra"}
          </span>
        ) : (
          <Link href={`${base}/checkout`} className="fo-btn fo-btn-primary w-full">
            Finalizar compra
          </Link>
        )}
        <Link href={base} className="block text-center text-sm underline underline-offset-4 opacity-80 hover:opacity-100">
          Seguir comprando
        </Link>
      </div>
    </div>
  );
}
