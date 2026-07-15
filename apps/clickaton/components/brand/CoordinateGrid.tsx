import { cn } from "@/lib/cn";

type CoordinateGridProps = {
  className?: string;
};

/** Patrón sutil de coordenadas urbanas. Decorativo. */
export function CoordinateGrid({ className }: CoordinateGridProps) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 opacity-[0.04]",
        "bg-[linear-gradient(to_right,rgb(255_255_255_/_0.55)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255_/_0.55)_1px,transparent_1px)]",
        "bg-size-[var(--ck-grid-size)_var(--ck-grid-size)]",
        "max-sm:opacity-[0.03]",
        className,
      )}
      aria-hidden="true"
    />
  );
}
