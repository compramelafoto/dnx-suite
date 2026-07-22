import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

const toneClass = {
  default: "border-ck-border bg-ck-surface text-ck-text",
  yellow: "border-ck-yellow/50 bg-[var(--ck-brand-primary-soft)] text-ck-yellow",
  /** Borde dorado sin relleno — iconos sobre fondos oscuros. */
  outline: "border-ck-yellow/60 bg-transparent text-ck-yellow",
  dark: "border-ck-yellow/40 bg-ck-bg text-ck-yellow",
} as const;

type IconFrameProps = HTMLAttributes<HTMLDivElement> & {
  tone?: keyof typeof toneClass;
  /** Accesible name for decorative numeric/icon frames. */
  label?: string;
  children: ReactNode;
};

export function IconFrame({
  tone = "default",
  label,
  className,
  children,
  ...props
}: IconFrameProps) {
  return (
    <div
      className={cn(
        "inline-flex size-12 items-center justify-center rounded-[var(--ck-radius-md)] border",
        toneClass[tone],
        className,
      )}
      {...props}
      aria-label={label ?? props["aria-label"]}
    >
      {children}
    </div>
  );
}
