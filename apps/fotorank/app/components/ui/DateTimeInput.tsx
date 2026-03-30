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
  "group/frdt flex w-full min-h-[3.25rem] cursor-pointer items-center justify-between gap-3 rounded-lg border border-[#262626] bg-[#0a0a0a] px-4 py-3 text-left text-base leading-relaxed shadow-sm transition-[border-color,box-shadow,background-color] hover:border-[#333333] hover:bg-[#0d0d0d] focus-visible:border-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/25";

const triggerWizard =
  "group/frdt flex min-h-[46px] w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-zinc-700 bg-[#050505] px-4 text-left text-sm text-white shadow-sm outline-none transition hover:border-zinc-600 focus-visible:border-amber-500 focus-visible:ring-2 focus-visible:ring-amber-500/25";

const triggerWizardCompact =
  "group/frdt flex min-h-[46px] w-full cursor-pointer items-center justify-between gap-3 rounded-lg border border-zinc-700 bg-[#050505] px-4 py-3 text-left text-sm text-white outline-none transition hover:border-zinc-600 focus-visible:border-amber-500 focus-visible:ring-2 focus-visible:ring-amber-500/25";

const iconWrapDefault =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[#333333] bg-[#111111] text-gold-soft transition-[color,border-color,background-color] group-hover/frdt:border-gold/35 group-hover/frdt:bg-[#141414] group-hover/frdt:text-gold group-focus-within/frdt:border-gold group-focus-within/frdt:text-gold";

const iconWrapWizard =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-zinc-600 bg-zinc-900 text-amber-400/90 transition-[color,border-color] group-hover/frdt:border-amber-500/50 group-hover/frdt:text-amber-300 group-focus-within/frdt:border-amber-400 group-focus-within/frdt:text-amber-300";

function CalendarGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}

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
  placeholder = "Elegí fecha y hora",
  microcopy,
}: DateTimeInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const displayValue = roundToNearest15(value);

  const handleOpen = () => {
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
  const iconWrap = isWizard ? iconWrapWizard : iconWrapDefault;

  const trigger = (
    <div className="relative min-h-[3.25rem] w-full">
      <input
        ref={inputRef}
        type="datetime-local"
        value={displayValue}
        onChange={handleChange}
        step={900}
        className="pointer-events-none absolute inset-0 z-0 h-full w-full opacity-0"
        aria-hidden
        tabIndex={-1}
      />
      <button
        id={id}
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleOpen();
        }}
        className={`relative z-10 w-full ${triggerClass}`}
        aria-label={`Elegir fecha y hora: ${label}`}
      >
        <span
          className={
            displayText
              ? isWizard
                ? "text-white"
                : "text-fr-primary"
              : isWizard
                ? "text-zinc-500"
                : "text-fr-muted-soft"
          }
        >
          {displayText || placeholder}
        </span>
        <span className={iconWrap} aria-hidden>
          <CalendarGlyph className="h-5 w-5" />
        </span>
      </button>
    </div>
  );

  if (isCompact) return trigger;

  if (isInline) {
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-4">
          <label htmlFor={id} className="shrink-0 text-sm font-medium text-white sm:text-base">
            {label}
          </label>
          {trigger}
        </div>
        {microcopy ? <p className="text-sm leading-relaxed text-zinc-500">{microcopy}</p> : null}
      </div>
    );
  }

  return (
    <FormField id={id} label={label} variant={variant} microcopy={microcopy}>
      {trigger}
    </FormField>
  );
}
