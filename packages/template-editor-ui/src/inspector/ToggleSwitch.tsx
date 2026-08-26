"use client";

import { cn } from "@/lib/utils";

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  className?: string;
};

export function ToggleSwitch({ checked, onChange, label, disabled, className }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-left text-xs text-[#374151] shadow-sm transition-colors hover:border-[#d1d5db]",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
      onClick={() => !disabled && onChange(!checked)}
    >
      <span className="font-medium">{label}</span>
      <span
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 rounded-full border border-transparent transition-colors",
          checked ? "bg-[#c27b3d]" : "bg-[#e5e7eb]"
        )}
      >
        <span
          className={cn(
            "pointer-events-none absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-[1.375rem]" : "translate-x-0"
          )}
        />
      </span>
    </button>
  );
}
