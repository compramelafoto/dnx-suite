import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type EditorialLabelProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: "default" | "yellow" | "dark";
  children: ReactNode;
};

export function EditorialLabel({
  tone = "default",
  className,
  children,
  ...props
}: EditorialLabelProps) {
  return (
    <span
      className={cn(
        "ck-label inline-flex w-fit items-center rounded-[var(--ck-radius-sm)] border px-2.5 py-1",
        tone === "default" && "border-ck-border bg-ck-surface text-ck-text-secondary",
        tone === "yellow" &&
          "border-ck-yellow/50 bg-[var(--ck-brand-primary-soft)] text-ck-yellow",
        tone === "dark" && "border-ck-yellow/40 bg-ck-bg text-ck-yellow",
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
