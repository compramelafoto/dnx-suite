"use client";

import { cn } from "@/lib/cn";
import type { PublicStoreVariant } from "@/lib/public-store/types";

type StoreVariantSelectorProps = {
  variants: PublicStoreVariant[];
  selectedVariantId: string | null;
  onSelect: (variantId: string) => void;
  label?: string;
  className?: string;
};

/**
 * Selector de variantes (talles / opciones) desde catálogo real.
 * Sin hardcode de talles. Solo UI — sin reservas ni writes.
 */
export function StoreVariantSelector({
  variants,
  selectedVariantId,
  onSelect,
  label = "Elegí tu opción",
  className,
}: StoreVariantSelectorProps) {
  if (variants.length === 0) return null;

  return (
    <fieldset className={cn("space-y-4", className)}>
      <legend className="ck-label text-ck-text-muted">{label}</legend>
      <div className="flex flex-wrap gap-3" role="radiogroup" aria-label={label}>
        {variants.map((variant) => {
          const selected = selectedVariantId === variant.id;
          const disabled = !variant.selectable;
          return (
            <button
              key={variant.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-disabled={disabled || undefined}
              disabled={disabled}
              title={disabled ? `${variant.name} — Agotado` : variant.name}
              onClick={() => {
                if (!disabled) onSelect(variant.id);
              }}
              className={cn(
                "inline-flex min-h-11 min-w-[2.75rem] flex-col items-center justify-center gap-0.5 px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ck-yellow focus-visible:ring-offset-2 focus-visible:ring-offset-ck-surface",
                "rounded-[var(--ck-radius-control)] border-2",
                disabled &&
                  "cursor-not-allowed border-ck-border bg-ck-bg-alt text-ck-text-muted opacity-70",
                !disabled &&
                  selected &&
                  "border-ck-yellow bg-[var(--ck-brand-primary-soft)] text-ck-yellow",
                !disabled &&
                  !selected &&
                  "border-ck-border bg-ck-surface text-ck-text hover:border-ck-yellow/50",
              )}
            >
              <span className={cn(disabled && "line-through")}>{variant.name}</span>
              {disabled ? (
                <span className="text-[10px] font-medium uppercase tracking-wide no-underline">
                  Agotado
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
