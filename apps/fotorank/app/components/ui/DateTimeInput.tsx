"use client";

import { useRef, type ReactNode } from "react";
import { FormField } from "./form";

/** Redondea los minutos al múltiplo de 15 más cercano (00, 15, 30, 45) */
function roundToNearest15(value: string): string {
  if (!value) return "";
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    const mins = d.getMinutes();
    const rounded = Math.round(mins / 15) * 15;
    d.setMinutes(rounded, 0, 0);
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return value;
  }
}

function formatDisplay(value: string): string {
  if (!value) return "";
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("es-AR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

const triggerDefault =
  "flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg border border-[#262626] bg-[#0a0a0a] px-5 py-4 text-base leading-relaxed text-left transition-colors hover:border-[#333] focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20";

const triggerWizard =
  "flex min-h-[46px] w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-zinc-700 bg-[#050505] px-4 text-sm text-white text-left outline-none transition hover:border-zinc-600 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20";

const triggerWizardCompact =
  "flex min-h-[46px] w-full cursor-pointer items-center justify-between gap-3 rounded-lg border border-zinc-700 bg-[#050505] px-5 py-3 text-sm text-white text-left outline-none transition hover:border-zinc-600 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20";

interface DateTimeInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  variant?: "default" | "wizard";
  /** Label al lado del input en vez de arriba */
  layout?: "stacked" | "inline";
  compact?: boolean;
  placeholder?: string;
  microcopy?: ReactNode;
}

export function DateTimeInput({
  id,
  label,
  value,
  onChange,
  variant = "default",
  layout = "stacked",
  compact = false,
  placeholder = "Seleccionar",
  microcopy,
}: DateTimeInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const displayValue = roundToNearest15(value);

  const handleClick = () => {
    inputRef.current?.focus();
    if (typeof inputRef.current?.showPicker === "function") {
      inputRef.current.showPicker();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    onChange(roundToNearest15(v) || v);
  };

  const displayText = formatDisplay(value);
  const isWizard = variant === "wizard";
  const isInline = layout === "inline" && isWizard;
  const isCompact = compact && isWizard;
  const triggerClass =
    isCompact || isInline ? triggerWizardCompact : isWizard ? triggerWizard : triggerDefault;

  const trigger = (
    <div className="relative min-h-[46px]">
      <input
        ref={inputRef}
        id={id}
        type="datetime-local"
        value={displayValue}
        onChange={handleChange}
        step={900}
        className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
        aria-label={label}
        tabIndex={-1}
      />
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleClick();
        }}
        className={triggerClass}
      >
        <span className={displayText ? "text-white" : "text-zinc-500"}>
          {displayText || placeholder}
        </span>
        <svg
          className="h-4 w-4 shrink-0 text-zinc-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </button>
    </div>
  );

  if (isCompact) return trigger;

  if (isInline) {
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-4">
          <label
            htmlFor={id}
            className="shrink-0 text-sm font-medium text-white sm:text-base"
          >
            {label}
          </label>
          {trigger}
        </div>
        {microcopy ? (
          <p className="text-xs leading-relaxed text-zinc-500">{microcopy}</p>
        ) : null}
      </div>
    );
  }

  return (
    <FormField id={id} label={label} variant={variant} microcopy={microcopy}>
      {trigger}
    </FormField>
  );
}
