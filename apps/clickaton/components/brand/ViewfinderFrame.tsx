import { cn } from "@/lib/cn";

type ViewfinderFrameProps = {
  className?: string;
};

/**
 * Visor fotográfico abstracto. No es logo ni isotipo institucional.
 * V2: panel oscuro + acentos amarillos (nunca fill amarillo dominante).
 */
export function ViewfinderFrame({ className }: ViewfinderFrameProps) {
  return (
    <div
      className={cn(
        "relative mx-auto aspect-square w-full max-w-[22rem] sm:max-w-[26rem]",
        className,
      )}
      aria-hidden="true"
    >
      <div className="absolute inset-[6%] rounded-[var(--ck-radius-sm)] border border-ck-border-strong bg-ck-surface shadow-[var(--ck-shadow-elevated)]" />
      <div className="absolute inset-[6%] rounded-[var(--ck-radius-sm)] border border-ck-yellow/25" />

      <span className="absolute left-[2%] top-[2%] h-8 w-8 border-l-2 border-t-2 border-ck-yellow" />
      <span className="absolute right-[2%] top-[2%] h-8 w-8 border-r-2 border-t-2 border-ck-yellow" />
      <span className="absolute bottom-[2%] left-[2%] h-8 w-8 border-b-2 border-l-2 border-ck-yellow" />
      <span className="absolute bottom-[2%] right-[2%] h-8 w-8 border-b-2 border-r-2 border-ck-yellow" />

      <div className="ck-frame-pulse absolute inset-[22%] rounded-full border border-ck-yellow/35" />
      <div className="absolute inset-[28%] rounded-full border border-dashed border-ck-text-muted/40" />

      <span className="absolute left-1/2 top-[18%] h-[64%] w-px -translate-x-1/2 bg-ck-text-muted/35" />
      <span className="absolute left-[18%] top-1/2 h-px w-[64%] -translate-y-1/2 bg-ck-text-muted/35" />
      <span className="absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ck-yellow bg-ck-bg" />

      <span className="ck-frame-scan absolute left-[12%] right-[12%] top-[12%] h-px bg-ck-yellow/50" />

      <span className="absolute left-1/2 top-[12%] h-2.5 w-0.5 -translate-x-1/2 bg-ck-yellow" />
      <span className="absolute bottom-[12%] left-1/2 h-2.5 w-0.5 -translate-x-1/2 bg-ck-yellow" />
      <span className="absolute left-[12%] top-1/2 h-0.5 w-2.5 -translate-y-1/2 bg-ck-yellow" />
      <span className="absolute right-[12%] top-1/2 h-0.5 w-2.5 -translate-y-1/2 bg-ck-yellow" />
    </div>
  );
}
