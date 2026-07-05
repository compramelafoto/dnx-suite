import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type CenteredProseProps = HTMLAttributes<HTMLParagraphElement> & {
  /** Ancho máximo legible (`max-w-2xl` ≈ 42rem por defecto) */
  maxWidthClassName?: string;
  size?: "xs" | "sm" | "md";
  className?: string;
  children?: ReactNode;
};

/**
 * Texto centrado con ancho razonable. Para intros de pestaña/card también existe `.ds-intro-prose`.
 * Útil bajo ancestros `flex flex-col items-center`:
 * los hijos pueden encogerse al `min-content` y terminar una palabra por línea si no llevan `w-full` en un wrapper.
 */
export default function CenteredProse({
  className,
  maxWidthClassName = "max-w-2xl",
  size = "sm",
  children,
  ...props
}: CenteredProseProps) {
  const sizeCls = size === "xs" ? "text-xs sm:text-sm" : size === "md" ? "text-base" : "text-sm";

  return (
    <div className="flex w-full min-w-0 shrink-0 justify-center px-3 sm:px-4">
      <p
        className={cn(
          "w-full min-w-0 max-w-full text-center text-[#6b7280] leading-relaxed whitespace-normal break-words",
          maxWidthClassName,
          sizeCls,
          className
        )}
        {...props}
      >
        {children}
      </p>
    </div>
  );
}
