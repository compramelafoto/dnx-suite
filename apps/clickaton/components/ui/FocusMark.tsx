import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type FocusMarkProps = HTMLAttributes<HTMLSpanElement> & {
  size?: "sm" | "md" | "lg";
};

/**
 * Marca de enfoque fotográfico. Decorativa — no es isotipo oficial.
 */
export function FocusMark({ size = "md", className, ...props }: FocusMarkProps) {
  const dim =
    size === "sm" ? "size-3" : size === "lg" ? "size-5" : "size-4";

  return (
    <span
      className={cn(
        "relative inline-flex items-center justify-center",
        dim,
        className,
      )}
      aria-hidden="true"
      {...props}
    >
      <span className="absolute inset-0 rounded-full border-2 border-current opacity-70" />
      <span className="absolute inset-[28%] rounded-full bg-current" />
      <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-current opacity-40" />
      <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-current opacity-40" />
    </span>
  );
}
