import { cn } from "@/lib/cn";

type ViewfinderFrameProps = {
  className?: string;
  label?: string;
};

/**
 * Visor fotográfico abstracto. No es logo ni isotipo institucional.
 */
export function ViewfinderFrame({
  className,
  label = "CLICK · TIME",
}: ViewfinderFrameProps) {
  return (
    <div
      className={cn(
        "relative mx-auto aspect-square w-full max-w-[22rem] sm:max-w-[26rem]",
        className,
      )}
      aria-hidden="true"
    >
      <div className="absolute inset-[6%] rounded-[var(--ck-radius-sm)] border-[3px] border-ck-black bg-ck-yellow shadow-[var(--ck-shadow-strong)]" />

      <span className="absolute left-[2%] top-[2%] h-8 w-8 border-l-[3px] border-t-[3px] border-ck-black" />
      <span className="absolute right-[2%] top-[2%] h-8 w-8 border-r-[3px] border-t-[3px] border-ck-black" />
      <span className="absolute bottom-[2%] left-[2%] h-8 w-8 border-b-[3px] border-l-[3px] border-ck-black" />
      <span className="absolute bottom-[2%] right-[2%] h-8 w-8 border-b-[3px] border-r-[3px] border-ck-black" />

      <div className="ck-frame-pulse absolute inset-[22%] rounded-full border-2 border-ck-black/40" />
      <div className="absolute inset-[28%] rounded-full border border-dashed border-ck-black/30" />

      <span className="absolute left-1/2 top-[18%] h-[64%] w-px -translate-x-1/2 bg-ck-black/25" />
      <span className="absolute left-[18%] top-1/2 h-px w-[64%] -translate-y-1/2 bg-ck-black/25" />
      <span className="absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ck-black bg-ck-white" />

      <span className="ck-frame-scan absolute left-[12%] right-[12%] top-[12%] h-px bg-ck-black/40" />

      <span className="absolute left-1/2 top-[12%] h-2.5 w-0.5 -translate-x-1/2 bg-ck-black" />
      <span className="absolute bottom-[12%] left-1/2 h-2.5 w-0.5 -translate-x-1/2 bg-ck-black" />
      <span className="absolute left-[12%] top-1/2 h-0.5 w-2.5 -translate-y-1/2 bg-ck-black" />
      <span className="absolute right-[12%] top-1/2 h-0.5 w-2.5 -translate-y-1/2 bg-ck-black" />

      <span className="ck-mono absolute bottom-[10%] left-1/2 -translate-x-1/2 rounded-[var(--ck-radius-sm)] bg-ck-black px-2 py-1 text-ck-yellow">
        {label}
      </span>
    </div>
  );
}
