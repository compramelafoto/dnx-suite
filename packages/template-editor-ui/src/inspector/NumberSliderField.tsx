"use client";

import { cn } from "../primitives/cn";

const rangeClass =
  "h-1.5 w-full min-w-0 cursor-pointer accent-[#c27b3d] disabled:cursor-not-allowed disabled:opacity-40";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

type Props = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  /** Accesibilidad y tooltip */
  ariaLabel: string;
  className?: string;
};

/**
 * Valor numérico con slider (px típicos en inspector de bloques).
 */
export function NumberSliderField({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  disabled,
  ariaLabel,
  className,
}: Props) {
  const v = Number.isFinite(value) ? value : 0;
  const shown = clamp(v, min, max);
  const dec = step < 1 ? Math.min(2, String(step).split(".")[1]?.length ?? 2) : 0;

  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className={rangeClass}
        value={shown}
        onChange={(e) => {
          const n = parseFloat(e.target.value);
          if (!Number.isFinite(n)) return;
          const rounded =
            dec > 0 ? Math.round(n * 10 ** dec) / 10 ** dec : Math.round(n);
          onChange(clamp(rounded, min, max));
        }}
        aria-label={ariaLabel}
        title={ariaLabel}
      />
      <span className="w-10 shrink-0 tabular-nums text-right text-xs font-medium text-[#374151]" aria-hidden>
        {dec > 0 ? shown.toLocaleString("es-AR", { maximumFractionDigits: dec }) : Math.round(shown)}
      </span>
    </div>
  );
}
