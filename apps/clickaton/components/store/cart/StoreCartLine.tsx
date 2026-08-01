"use client";

import Link from "next/link";
import { StoreCartQuantity } from "@/components/store/cart/StoreCartQuantity";
import { Button } from "@/components/ui/Button";
import { FocusMark } from "@/components/ui/FocusMark";
import { storeProductPath } from "@/config/navigation";
import { formatPublicPrice } from "@/lib/public-registration/ui/format";
import type { StoreCartValidatedLine } from "@/lib/public-store/cart";
import { cn } from "@/lib/cn";

type StoreCartLineProps = {
  line: StoreCartValidatedLine;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
  compact?: boolean;
};

export function StoreCartLine({
  line,
  onQuantityChange,
  onRemove,
  compact = false,
}: StoreCartLineProps) {
  const invalid = !line.contributesToSubtotal;
  const href = line.product.slug ? storeProductPath(line.product.slug) : routesFallback;
  const unitLabel = formatPublicPrice(line.unitPriceMinor, line.currency);
  const subLabel = formatPublicPrice(line.lineSubtotalMinor, line.currency);

  return (
    <article
      className={cn(
        "flex gap-4 border-b border-ck-border py-6 last:border-b-0",
        invalid && "opacity-80",
        compact ? "py-4" : "py-6",
      )}
      aria-label={`${line.product.name}${line.variant ? `, ${line.variant.name}` : ""}`}
    >
      <div className="relative size-20 shrink-0 overflow-hidden border border-ck-border bg-ck-bg-alt sm:size-24">
        {line.product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={line.product.imageUrl}
            alt={line.product.imageAlt}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-ck-text-muted">
            <FocusMark size="sm" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-3">
        <div className="space-y-1">
          {line.product.slug ? (
            <Link
              href={href}
              className="ck-heading-md transition-colors hover:text-ck-yellow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ck-yellow"
            >
              {line.product.name}
            </Link>
          ) : (
            <p className="ck-heading-md">{line.product.name}</p>
          )}
          {line.variant ? (
            <p className="ck-body-sm text-ck-text-secondary">
              Opción: {line.variant.name}
            </p>
          ) : null}
          {line.messages[0] ? (
            <p className="ck-body-sm text-[var(--ck-warning)]" role="status">
              {line.messages[0]}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <p className="ck-label text-ck-text-muted">
              Precio unitario{" "}
              <span className="text-ck-text" aria-label={`Precio unitario ${unitLabel}`}>
                {unitLabel}
              </span>
            </p>
            {!invalid ? (
              <StoreCartQuantity
                value={line.quantity}
                max={Math.max(1, line.maxQuantity)}
                onChange={onQuantityChange}
                label={`Cantidad de ${line.product.name}`}
              />
            ) : null}
          </div>
          <div className="space-y-2 text-right">
            {!invalid ? (
              <p
                className="ck-heading-md text-ck-yellow"
                aria-label={`Subtotal ${subLabel}`}
              >
                {subLabel}
              </p>
            ) : (
              <p className="ck-body-sm text-ck-text-muted">No incluido en el subtotal</p>
            )}
            <Button type="button" variant="text" size="sm" onClick={onRemove}>
              Eliminar
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}

const routesFallback = "/tienda";
