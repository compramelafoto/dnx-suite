import { cn } from "@/lib/cn";
import type { StoreAvailabilityView } from "@/lib/public-store/availability";

type StoreAvailabilityProps = {
  availability: StoreAvailabilityView;
  className?: string;
};

const kindClass: Record<StoreAvailabilityView["kind"], string> = {
  available: "border-[var(--ck-success)]/40 bg-[var(--ck-success-soft)] text-[var(--ck-success)]",
  low_stock: "border-[var(--ck-warning)]/40 bg-[var(--ck-warning-soft)] text-[var(--ck-warning)]",
  sold_out: "border-ck-border bg-ck-surface-strong text-ck-text-muted",
};

/**
 * Presentación de disponibilidad (Disponible / Últimas unidades / Agotado).
 * El texto no depende solo del color.
 */
export function StoreAvailability({ availability, className }: StoreAvailabilityProps) {
  return (
    <p
      className={cn(
        "ck-label inline-flex w-fit items-center rounded-[var(--ck-radius-sm)] border px-2.5 py-1",
        kindClass[availability.kind],
        className,
      )}
      role="status"
      aria-live="polite"
    >
      {availability.label}
      {availability.kind === "low_stock" && availability.availableStock > 0
        ? ` · ${availability.availableStock}`
        : null}
    </p>
  );
}
