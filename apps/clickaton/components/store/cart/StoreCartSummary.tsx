"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatPublicPrice } from "@/lib/public-registration/ui/format";
import type { StoreCartTotals } from "@/lib/public-store/cart";
import { cn } from "@/lib/cn";

type StoreCartSummaryProps = {
  totals: StoreCartTotals;
  className?: string;
  checkoutEnabled?: boolean;
  checkoutReady?: boolean;
  checkoutHref?: string;
};

export function StoreCartSummary({
  totals,
  className,
  checkoutEnabled = false,
  checkoutReady = false,
  checkoutHref = "/tienda/checkout",
}: StoreCartSummaryProps) {
  const subtotalLabel = formatPublicPrice(totals.subtotalMinor, totals.currency);
  const canGoCheckout = checkoutEnabled && checkoutReady;

  return (
    <Card className={cn("space-y-6", className)} aria-label="Resumen del carrito">
      <div className="space-y-3">
        <h2 className="ck-heading-md">Resumen</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-ck-text-secondary">Productos</dt>
            <dd className="font-semibold text-ck-text">
              {totals.validUnitCount}{" "}
              {totals.validUnitCount === 1 ? "unidad" : "unidades"}
            </dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-ck-border pt-3">
            <dt className="ck-heading-md">Subtotal</dt>
            <dd
              className="ck-heading-md text-ck-yellow"
              aria-label={`Subtotal ${subtotalLabel}`}
            >
              {subtotalLabel}
            </dd>
          </div>
        </dl>
        <p className="ck-body-sm text-ck-text-muted">
          Los costos de entrega se confirman en el checkout (retiro sin cargo en esta
          etapa).
        </p>
        <p className="ck-caption text-ck-text-muted">
          Los productos no quedan reservados hasta confirmar la compra.
        </p>
      </div>

      <div className="space-y-2 border-t border-ck-border pt-6">
        {canGoCheckout ? (
          <Button
            href={checkoutHref}
            variant="primary"
            size="lg"
            className="w-full"
            data-testid="store-checkout-cta"
          >
            Continuar con la compra
          </Button>
        ) : (
          <>
            <Button
              type="button"
              variant="primary"
              size="lg"
              disabled
              aria-disabled="true"
              className="w-full"
              title={
                checkoutEnabled
                  ? "Corregí el carrito para continuar"
                  : "Checkout deshabilitado"
              }
              data-testid="store-checkout-disabled"
            >
              Continuar con la compra
            </Button>
            <p className="ck-body-sm text-center text-ck-text-muted">
              {checkoutEnabled
                ? "Corregí los productos del carrito para continuar."
                : "Checkout deshabilitado (feature flag)."}
            </p>
          </>
        )}
      </div>
    </Card>
  );
}
