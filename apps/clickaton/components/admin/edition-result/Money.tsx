import { cn } from "@/lib/cn";

/** Pesos sin centavos, como se habla de plata en la organización. */
export function formatPesos(minor: number): string {
  const pesos = Math.round(minor / 100);
  const abs = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(Math.abs(pesos));
  return `${pesos < 0 ? "−" : ""}$ ${abs}`;
}

export function Money({
  minor,
  signed = false,
  className,
}: {
  minor: number;
  /** Colorea en verde/rojo según el signo. */
  signed?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "tabular-nums",
        signed && minor > 0 && "text-ck-success",
        signed && minor < 0 && "text-ck-danger",
        className,
      )}
    >
      {formatPesos(minor)}
    </span>
  );
}

export function StatTile({
  label,
  minor,
  hint,
  signed,
  strong,
}: {
  label: string;
  minor: number;
  hint?: string;
  signed?: boolean;
  strong?: boolean;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-[var(--ck-radius-sm)] border border-ck-border p-4",
        strong && "border-ck-border-strong bg-ck-surface-strong",
      )}
    >
      <p className="text-xs uppercase tracking-[0.1em] text-ck-text-muted">{label}</p>
      <p className={cn("mt-1 font-semibold text-ck-text", strong ? "text-2xl" : "text-xl")}>
        <Money minor={minor} signed={signed} />
      </p>
      {hint ? <p className="mt-1 text-xs text-ck-text-muted">{hint}</p> : null}
    </div>
  );
}
