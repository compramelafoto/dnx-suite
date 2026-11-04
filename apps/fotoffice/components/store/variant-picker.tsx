"use client";

import type { StoreVariantOption } from "@/lib/store/storefront";
import { isModelSoldOut, sizesForModel, type VariantAxes } from "@/lib/store/variant-axes";

const CLASE_BOTON = "min-h-11 min-w-11 rounded-[var(--fo-radius-sm)] border px-3 text-sm font-medium transition-colors";
const CLASE_ELEGIDO = "border-[var(--fo-accent)] bg-[var(--fo-accent)] text-[var(--fo-on-accent,#fff)]";
const CLASE_LIBRE = "border-[var(--fo-border-strong)] bg-[var(--fo-surface)] hover:border-[var(--fo-text)]";
const CLASE_AGOTADO = "disabled:cursor-not-allowed disabled:line-through disabled:opacity-40";

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
              className={`${CLASE_BOTON} ${elegido ? CLASE_ELEGIDO : CLASE_LIBRE} ${CLASE_AGOTADO}`}
            >
              {v.name}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * Modelo y talle en dos grupos, cuando las variantes se llaman "Modelo / Talle". El talle muestra
 * sólo los del modelo elegido; los agotados (y los modelos sin ningún talle disponible) se ven
 * tachados y no se pueden elegir.
 */
export function VariantAxesPicker({
  axes,
  model,
  variantId,
  onModelChange,
  onVariantChange,
}: {
  axes: VariantAxes;
  model: string | null;
  variantId: string | null;
  onModelChange: (model: string) => void;
  onVariantChange: (id: string) => void;
}) {
  const talles = sizesForModel(axes, model);
  return (
    <div className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Modelo</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup">
          {axes.models.map((m) => {
            const agotado = isModelSoldOut(axes, m);
            const elegido = m === model;
            return (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={elegido}
                disabled={agotado}
                onClick={() => onModelChange(m)}
                aria-label={agotado ? `${m}, agotado` : m}
                className={`${CLASE_BOTON} ${elegido ? CLASE_ELEGIDO : CLASE_LIBRE} ${CLASE_AGOTADO}`}
              >
                {m}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Talle</legend>
        {model === null ? (
          <p className="text-sm text-[var(--fo-muted)]">Elegí primero un modelo.</p>
        ) : (
          <div className="flex flex-wrap gap-2" role="radiogroup">
            {talles.map((o) => {
              const agotado = o.available === 0;
              const elegido = o.variantId === variantId;
              return (
                <button
                  key={o.variantId}
                  type="button"
                  role="radio"
                  aria-checked={elegido}
                  disabled={agotado}
                  onClick={() => onVariantChange(o.variantId)}
                  aria-label={agotado ? `${o.size}, agotado` : o.size}
                  className={`${CLASE_BOTON} ${elegido ? CLASE_ELEGIDO : CLASE_LIBRE} ${CLASE_AGOTADO}`}
                >
                  {o.size}
                </button>
              );
            })}
          </div>
        )}
      </fieldset>
    </div>
  );
}
