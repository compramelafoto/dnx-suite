import { ImagePlaceholderIcon } from "@/components/formar-parte/JoinIcons";
import { cn } from "@/lib/cn";

type ImagePlaceholderProps = {
  code: string;
  label: string;
  className?: string;
  /** Altura mínima del área visual. */
  minHeightClassName?: string;
};

/** Placeholder elegante con borde punteado — sin imágenes reales. */
export function ImagePlaceholder({
  code,
  label,
  className,
  minHeightClassName = "min-h-[14rem]",
}: ImagePlaceholderProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 border-2 border-dashed border-ck-border bg-ck-surface-base/40 px-6 py-10 text-center transition-colors duration-[var(--ck-duration-base)] ease-[var(--ck-easing-standard)] hover:border-ck-yellow/40",
        minHeightClassName,
        className,
      )}
    >
      <span className="text-ck-text-muted">
        <ImagePlaceholderIcon className="size-9" />
      </span>
      <div className="space-y-2">
        <p
          className="text-sm font-semibold uppercase tracking-[0.18em] text-ck-yellow"
          style={{ fontFamily: "var(--ck-font-sans)" }}
        >
          {code}
        </p>
        <p className="ck-body-sm text-ck-text-secondary">{label}</p>
      </div>
    </div>
  );
}
