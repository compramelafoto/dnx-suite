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
    <div className={cn("space-y-0.5", className)}>
      {label ? <span className="block text-[11px] text-[color:var(--te-ink-muted)]">{label}</span> : null}
      <div className="flex items-center gap-1">
        <input
          type="color"
          className="h-6 w-8 shrink-0 cursor-pointer rounded-[var(--te-radius)] border border-[color:var(--te-line)] bg-[color:var(--te-surface)] p-0.5 disabled:opacity-50"
          value={colorInputValue}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label ?? "Color"}
        />
        <input
          type="text"
          className="h-6 min-w-0 flex-1 rounded-[var(--te-radius)] border border-[color:var(--te-line)] bg-[color:var(--te-surface)] px-1.5 font-mono text-[11px] text-[color:var(--te-ink)] focus:border-[color:var(--te-accent)] focus:outline-none"
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
