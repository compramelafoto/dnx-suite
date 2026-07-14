import type { ElementType, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

const variantClass = {
  default: "border-ck-border bg-ck-surface shadow-[var(--ck-shadow-subtle)]",
  outlined: "border-ck-border-strong bg-transparent",
  dark: "border-ck-border-strong bg-ck-black text-ck-white",
  yellow: "border-ck-border-strong bg-ck-yellow text-ck-black",
  interactive:
    "border-ck-border bg-ck-surface shadow-[var(--ck-shadow-subtle)] transition-[transform,box-shadow] duration-[var(--ck-duration-base)] ease-[var(--ck-easing-standard)] hover:-translate-y-0.5 hover:shadow-[var(--ck-shadow-elevated)]",
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
        "rounded-[var(--ck-radius-md)] border-2 p-5 sm:p-6",
        variantClass[variant],
        className,
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}
