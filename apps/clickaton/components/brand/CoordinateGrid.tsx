import { cn } from "@/lib/cn";

type CoordinateGridProps = {
  className?: string;
};

/** Patrón sutil de coordenadas. Decorativo. */
export function CoordinateGrid({ className }: CoordinateGridProps) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 opacity-[0.07]",
        "bg-[linear-gradient(to_right,var(--ck-brand-ink)_1px,transparent_1px),linear-gradient(to_bottom,var(--ck-brand-ink)_1px,transparent_1px)]",
        "bg-size-[2.5rem_2.5rem]",
        "max-sm:opacity-[0.04]",
        className,
      )}
      aria-hidden="true"
    />
  );
}
