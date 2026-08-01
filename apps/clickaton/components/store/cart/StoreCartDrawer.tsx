"use client";

import { useEffect, useId, useRef } from "react";
import Link from "next/link";
import { useStoreCart } from "@/components/store/cart/StoreCartProvider";
import { StoreCartIssues } from "@/components/store/cart/StoreCartIssues";
import { StoreCartLine } from "@/components/store/cart/StoreCartLine";
import { Button } from "@/components/ui/Button";
import { routes } from "@/config/navigation";
import { formatPublicPrice } from "@/lib/public-registration/ui/format";
import { cn } from "@/lib/cn";

export function StoreCartDrawer() {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const {
    isCartOpen,
    closeCart,
    validatedCart,
    validationState,
    validationError,
    refreshValidation,
    updateQuantity,
    removeItem,
    itemCount,
    hydrationState,
  } = useStoreCart();

  useEffect(() => {
    if (!isCartOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeCart();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [isCartOpen, closeCart]);

  if (!isCartOpen) return null;

  const lines = validatedCart?.lines ?? [];
  const subtotal = validatedCart
    ? formatPublicPrice(
        validatedCart.totals.subtotalMinor,
        validatedCart.totals.currency,
      )
    : null;

  return (
    <div className="fixed inset-0 z-[80]" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Cerrar carrito"
        onClick={closeCart}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-ck-border bg-ck-bg shadow-[var(--ck-shadow-elevated)]",
        )}
      >
        <div className="flex items-center justify-between border-b border-ck-border px-6 py-4">
          <h2 id={titleId} className="ck-heading-md">
            Tu carrito
          </h2>
          <Button
            ref={closeRef}
            type="button"
            variant="ghost"
            size="sm"
            onClick={closeCart}
            aria-label="Cerrar carrito"
          >
            Cerrar
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {hydrationState !== "ready" ? (
            <p className="ck-body-sm text-ck-text-muted">Cargando carrito…</p>
          ) : itemCount === 0 ? (
            <p className="ck-body-sm text-ck-text-secondary">
              Todavía no agregaste productos.{" "}
              <Link
                href={routes.store}
                className="text-ck-yellow underline-offset-4 hover:underline"
                onClick={closeCart}
              >
                Ver tienda
              </Link>
            </p>
          ) : validationState === "error" ? (
            <div className="space-y-4">
              <p className="ck-body-sm text-[var(--ck-warning)]" role="alert">
                {validationError ?? "No se pudo validar el carrito."}
              </p>
              <Button type="button" variant="secondary" onClick={() => void refreshValidation()}>
                Reintentar
              </Button>
            </div>
          ) : (
            <>
              <StoreCartIssues
                issues={validatedCart?.issues}
                lines={lines}
                className="mb-4"
              />
              {validationState === "loading" && !validatedCart ? (
                <p className="ck-body-sm text-ck-text-muted">Validando…</p>
              ) : null}
              <ul className="divide-y-0">
                {lines.map((line) => (
                  <li key={line.lineKey}>
                    <StoreCartLine
                      line={line}
                      compact
                      onQuantityChange={(quantity) =>
                        updateQuantity(line.lineKey, quantity, line.availableStock)
                      }
                      onRemove={() => removeItem(line.lineKey)}
                    />
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="space-y-4 border-t border-ck-border px-6 py-5">
          {subtotal ? (
            <p className="flex justify-between gap-4">
              <span className="ck-label text-ck-text-muted">Subtotal</span>
              <span className="ck-heading-md text-ck-yellow" aria-label={`Subtotal ${subtotal}`}>
                {subtotal}
              </span>
            </p>
          ) : null}
          <Button
            href={routes.storeCart}
            variant="primary"
            className="w-full"
            onClick={closeCart}
          >
            Revisar carrito
          </Button>
        </div>
      </div>
    </div>
  );
}
