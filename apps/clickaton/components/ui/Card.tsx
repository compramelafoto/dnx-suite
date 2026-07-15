import type { ElementType, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

const variantClass = {
  default:
    "border-ck-border bg-ck-surface shadow-[var(--ck-shadow-subtle)]",
  outlined: "border-ck-border-strong bg-transparent",
  dark: "border-ck-border bg-ck-bg text-ck-text shadow-[var(--ck-shadow-subtle)]",
  /** Acento editorial: superficie oscura + borde amarillo (nunca fill amarillo). */
  yellow:
    "border-ck-border bg-ck-surface text-ck-text shadow-[var(--ck-shadow-subtle)] border-t-2 border-t-ck-yellow",
  interactive:
    "border-ck-border bg-ck-surface shadow-[var(--ck-shadow-subtle)] transition-[transform,box-shadow,border-color,background-color] duration-[var(--ck-duration-base)] ease-[var(--ck-easing-standard)] hover:-translate-y-0.5 hover:scale-[1.01] hover:border-ck-yellow/40 hover:shadow-[var(--ck-shadow-elevated)]",
} as const;

type CardProps = HTMLAttributes<HTMLElement> & {
  as?: ElementType;
  variant?: keyof typeof variantClass;
  children: ReactNode;
};

export function Card({
  as: Tag = "div",
  variant = "default",
  className,
  children,
  ...props
}: CardProps) {
  return (
    <Tag
      className={cn(
        "rounded-[var(--ck-radius-card)] border p-6 sm:p-8",
        variantClass[variant],
        className,
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}
