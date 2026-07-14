import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

const variantClass = {
  neutral: "border-ck-border bg-ck-surface-strong text-ck-text-secondary",
  brand: "border-ck-border-strong bg-ck-yellow text-ck-black",
  accent: "border-ck-accent bg-ck-accent-soft text-ck-accent",
  success: "border-[var(--ck-success)] bg-[var(--ck-success-soft)] text-[var(--ck-success)]",
  warning: "border-[var(--ck-warning)] bg-[var(--ck-warning-soft)] text-[var(--ck-warning)]",
  danger: "border-[var(--ck-danger)] bg-[var(--ck-danger-soft)] text-[var(--ck-danger)]",
} as const;

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: keyof typeof variantClass;
  children: ReactNode;
};

export function Badge({
  variant = "neutral",
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "ck-label inline-flex w-fit items-center rounded-[var(--ck-radius-sm)] border-2 px-2.5 py-1",
        variantClass[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
