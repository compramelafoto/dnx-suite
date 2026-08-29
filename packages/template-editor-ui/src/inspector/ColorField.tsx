"use client";

import { useMemo } from "react";
import { cn } from "../primitives/cn";

function normalizeHex(raw: string): string {
  const s = raw.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(s)) return s;
  if (/^#[0-9A-Fa-f]{3}$/.test(s)) {
    const r = s[1];
    const g = s[2];
    const b = s[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return s;
}

type Props = {
  value: string;
  onChange: (hex: string) => void;
  label?: string;
  className?: string;
  disabled?: boolean;
};

export function ColorField({ value, onChange, label, className, disabled }: Props) {
  const colorInputValue = useMemo(() => {
    const n = normalizeHex(value || "#000000");
    return /^#[0-9A-Fa-f]{6}$/i.test(n) ? n : "#000000";
  }, [value]);

  return (
    <div className={cn("space-y-1.5", className)}>
      {label ? <span className="text-xs font-medium text-[color:var(--te-ink)]">{label}</span> : null}
      <div className="flex items-center gap-2">
        <input
          type="color"
          className="h-9 w-11 cursor-pointer rounded-md border border-[color:var(--te-line)] bg-white p-0.5 shadow-sm disabled:opacity-50"
          value={colorInputValue}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label ?? "Color"}
        />
        <input
          type="text"
          className="min-w-0 flex-1 rounded-lg border border-[color:var(--te-line)] bg-white px-2 py-1.5 font-mono text-xs text-[color:var(--te-ink)] shadow-sm focus:border-[color:var(--te-accent)] focus:outline-none focus:ring-1 focus:ring-[color:var(--te-accent-wash)]"
          value={value}
          disabled={disabled}
          spellCheck={false}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
        />
      </div>
    </div>
  );
}
