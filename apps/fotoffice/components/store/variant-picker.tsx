"use client";

import type { StoreVariantOption } from "@/lib/store/storefront";

/**
 * Los talles como botones. Los agotados se ven tachados y no se pueden elegir. Es un grupo de
 * radios accesible: el lector de pantalla anuncia cuál está elegido y cuál está agotado.
 */
export function VariantPicker({
  variants,
  value,
  onChange,
}: {
  variants: StoreVariantOption[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Talle</legend>
      <div className="flex flex-wrap gap-2" role="radiogroup">
        {variants.map((v) => {
          const agotado = v.available === 0;
          const elegido = v.id === value;
          return (
            <button
              key={v.id}
              type="button"
              role="radio"
              aria-checked={elegido}
              disabled={agotado}
              onClick={() => onChange(v.id)}
              aria-label={agotado ? `${v.name}, agotado` : v.name}
              className={`min-h-11 min-w-11 rounded-[var(--fo-radius-sm)] border px-3 text-sm font-medium transition-colors ${
                elegido
                  ? "border-[var(--fo-accent)] bg-[var(--fo-accent)] text-white"
                  : "border-[var(--fo-border-strong)] bg-[var(--fo-surface)] hover:border-[var(--fo-text)]"
              } disabled:cursor-not-allowed disabled:line-through disabled:opacity-40`}
            >
              {v.name}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
