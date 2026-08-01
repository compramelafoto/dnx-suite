"use client";

import { useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type Row = {
  label: string;
  value: ReactNode;
  mono?: boolean;
  copyText?: string;
};

type Props = {
  title?: string;
  description?: string;
  rows: Row[];
  defaultOpen?: boolean;
  className?: string;
};

/**
 * Bloque colapsable para IDs y referencias de soporte.
 * Cerrado por defecto. No debe usarse para secretos.
 */
export function AdminTechnicalInfo({
  title = "Información técnica",
  description = "Datos para soporte y auditoría. No son necesarios para la operación diaria.",
  rows,
  defaultOpen = false,
  className,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <section
      className={cn(
        "rounded-[var(--ck-radius-card)] border border-dashed border-ck-border bg-ck-surface/40",
        className,
      )}
    >
      <button
        type="button"
        className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-3 text-left"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <span>
          <span className="block text-sm font-semibold text-ck-text">{title}</span>
          <span className="mt-1 block text-xs text-ck-text-muted">{description}</span>
        </span>
        <span className="text-sm text-ck-yellow" aria-hidden>
          {open ? "Ocultar" : "Mostrar"}
        </span>
      </button>
      {open ? (
        <dl id={panelId} className="grid gap-3 border-t border-ck-border px-4 py-4 text-sm sm:grid-cols-2">
          {rows.map((row) => (
            <div key={row.label} className="min-w-0 space-y-1">
              <dt className="text-ck-text-secondary">{row.label}</dt>
              <dd className={cn("break-all text-ck-text", row.mono && "font-mono text-xs")}>
                {row.value}
                {row.copyText ? (
                  <CopyButton text={row.copyText} ariaLabel={`Copiar ${row.label}`} />
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  );
}

function CopyButton({ text, ariaLabel }: { text: string; ariaLabel: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="ml-2 inline-flex min-h-9 min-w-9 items-center justify-center rounded border border-ck-border px-2 text-xs text-ck-yellow hover:border-ck-yellow"
      aria-label={ariaLabel}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          window.setTimeout(() => setDone(false), 1500);
        } catch {
          setDone(false);
        }
      }}
    >
      {done ? "Copiado" : "Copiar"}
    </button>
  );
}
