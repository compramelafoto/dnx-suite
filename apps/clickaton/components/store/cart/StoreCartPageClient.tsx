"use client";

import { useStoreCart } from "@/components/store/cart/StoreCartProvider";
import { StoreCartEmptyState } from "@/components/store/cart/StoreCartEmptyState";
import { StoreCartIssues } from "@/components/store/cart/StoreCartIssues";
import { StoreCartLine } from "@/components/store/cart/StoreCartLine";
import { StoreCartSummary } from "@/components/store/cart/StoreCartSummary";
import { Button } from "@/components/ui/Button";
import { routes } from "@/config/navigation";

type Props = {
  checkoutEnabled?: boolean;
};

export function StoreCartPageClient({ checkoutEnabled = false }: Props) {
  const {
    items,
    itemCount,
    hydrationState,
    validatedCart,
    validationState,
    validationError,
    refreshValidation,
    updateQuantity,
    removeItem,
    clearCart,
  } = useStoreCart();

  if (hydrationState === "loading") {
    return <p className="ck-body-sm text-ck-text-muted">Cargando carrito…</p>;
  }

  if (itemCount === 0 || items.length === 0) {
    return <StoreCartEmptyState />;
  }

  const lines = validatedCart?.lines ?? [];
  const totals = validatedCart?.totals ?? {
    currency: "ARS",
    subtotalMinor: 0,
    validUnitCount: 0,
    requestedUnitCount: itemCount,
    validLineCount: 0,
    issueCount: 0,
  };

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start xl:grid-cols-[minmax(0,1fr)_22rem] xl:gap-12">
      <div className="min-w-0 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="ck-body-sm text-ck-text-secondary">
            {itemCount} {itemCount === 1 ? "unidad" : "unidades"} en tu carrito
          </p>
          <Button type="button" variant="text" size="sm" onClick={clearCart}>
            Vaciar carrito
          </Button>
        </div>

        {validationState === "error" ? (
          <div className="space-y-3 rounded-[var(--ck-radius-md)] border border-[var(--ck-warning)]/40 bg-[var(--ck-warning-soft)] p-4">
            <p className="ck-body-sm text-ck-text" role="alert">
              {validationError ?? "No se pudo validar el carrito."}
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => void refreshValidation()}
            >
              Reintentar validación
            </Button>
          </div>
        ) : (
          <StoreCartIssues issues={validatedCart?.issues} lines={lines} />
        )}

        {validationState === "loading" && !validatedCart ? (
          <p className="ck-body-sm text-ck-text-muted">Validando precios y stock…</p>
        ) : null}

        <div className="rounded-[var(--ck-radius-card)] border border-ck-border bg-ck-surface px-4 sm:px-6">
          {lines.length > 0 ? (
            lines.map((line) => (
              <StoreCartLine
                key={line.lineKey}
                line={line}
                onQuantityChange={(quantity) =>
                  updateQuantity(line.lineKey, quantity, line.availableStock)
                }
                onRemove={() => removeItem(line.lineKey)}
              />
            ))
          ) : (
            <p className="ck-body-sm py-8 text-ck-text-muted">
              Hay productos en tu carrito local. Validá para ver el resumen.
            </p>
          )}
        </div>

        <Button href={routes.store} variant="secondary">
          Seguir comprando
        </Button>
      </div>

      <aside className="lg:sticky lg:top-28">
        <StoreCartSummary
          totals={totals}
          checkoutEnabled={checkoutEnabled}
          checkoutReady={Boolean(validatedCart?.checkoutReady)}
          checkoutHref={routes.storeCheckout}
        />
      </aside>
    </div>
  );
}
