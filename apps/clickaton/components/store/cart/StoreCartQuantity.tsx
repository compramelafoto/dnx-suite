"use client";

import { cn } from "@/lib/cn";

type StoreCartQuantityProps = {
  value: number;
  min?: number;
  max: number;
  onChange: (next: number) => void;
  disabled?: boolean;
  id?: string;
  label?: string;
  className?: string;
};

/**
 * Control − / input / + para cantidades del carrito.
 */
export function StoreCartQuantity({
  value,
  min = 1,
  max,
  onChange,
  disabled = false,
  id,
  label = "Cantidad",
  className,
}: StoreCartQuantityProps) {
  const effectiveMax = Math.max(min, max);
  const atMin = value <= min;
  const atMax = value >= effectiveMax;

  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <span className="sr-only" id={id ? `${id}-label` : undefined}>
        {label}
      </span>
      <button
        type="button"
        className="inline-flex size-11 items-center justify-center rounded-[var(--ck-radius-control)] border-2 border-ck-border text-ck-text transition-colors hover:border-ck-yellow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ck-yellow disabled:opacity-50"
        aria-label={`Disminuir ${label.toLowerCase()}`}
        disabled={disabled || atMin}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        −
      </button>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={effectiveMax}
        value={value}
        disabled={disabled}
        aria-labelledby={id ? `${id}-label` : undefined}
        aria-label={label}
        className="h-11 w-16 rounded-[var(--ck-radius-control)] border-2 border-ck-border bg-ck-bg px-2 text-center text-sm font-semibold text-ck-text focus-visible:border-ck-yellow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ck-yellow"
        onChange={(e) => {
          const n = Number.parseInt(e.target.value, 10);
          if (!Number.isFinite(n)) return;
          onChange(Math.min(effectiveMax, Math.max(min, n)));
        }}
      />
      <button
        type="button"
        className="inline-flex size-11 items-center justify-center rounded-[var(--ck-radius-control)] border-2 border-ck-border text-ck-text transition-colors hover:border-ck-yellow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ck-yellow disabled:opacity-50"
        aria-label={`Aumentar ${label.toLowerCase()}`}
        disabled={disabled || atMax || effectiveMax < min}
        onClick={() => onChange(Math.min(effectiveMax, value + 1))}
      >
        +
      </button>
    </div>
  );
}
