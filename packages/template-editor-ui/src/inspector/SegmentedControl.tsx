"use client";

import { cn } from "../primitives/cn";

export type SegmentOption<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: SegmentOption<T>[];
  className?: string;
  disabled?: boolean;
};

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  className,
  disabled,
}: Props<T>) {
  return (
    <div
      className={cn(
        "inline-flex min-w-0 rounded-lg border border-[color:var(--te-line)] bg-[color:var(--te-chrome-sunken)] p-0.5 shadow-inner",
        disabled && "pointer-events-none opacity-50",
        className
      )}
      role="group"
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={cn(
            "min-w-0 flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors",
            value === opt.value
              ? "bg-white text-[color:var(--te-ink)] shadow-sm"
              : "text-[color:var(--te-ink-muted)] hover:text-[color:var(--te-ink)]"
          )}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
