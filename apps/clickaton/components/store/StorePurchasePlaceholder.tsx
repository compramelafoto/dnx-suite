"use client";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

type StorePurchasePlaceholderProps = {
  /** Solo afecta copy/estilo; nunca habilita compra. */
  variantSelected?: boolean;
  className?: string;
};

/**
 * Placeholder comercial Etapa 03.
 * El botón permanece siempre deshabilitado — sin carrito, APIs ni persistencia de compra.
 */
export function StorePurchasePlaceholder({
  variantSelected = false,
  className,
}: StorePurchasePlaceholderProps) {
  return (
    <div className={cn("space-y-3", className)} data-store-purchase="disabled">
      <Button
        type="button"
        variant="primary"
        size="lg"
        disabled
        aria-disabled="true"
        className="w-full sm:w-auto"
        data-testid="store-add-to-cart-disabled"
        title="Compra online próximamente"
      >
        Agregar al carrito
      </Button>
      <p className="ck-body-sm text-ck-text-muted">
        Compra online próximamente.
        {variantSelected
          ? " Seleccionaste una opción; la compra se habilitará en una etapa posterior."
          : null}
      </p>
    </div>
  );
}
