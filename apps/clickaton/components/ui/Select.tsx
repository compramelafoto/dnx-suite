import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  invalid?: boolean;
};

export function Select({ className, invalid, disabled, children, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        "min-h-11 w-full appearance-none rounded-[var(--ck-radius-control)] border bg-ck-surface px-4 py-3 text-base text-ck-text transition-[border-color,box-shadow,background-color] duration-[var(--ck-duration-base)] ease-[var(--ck-easing-standard)]",
        "border-ck-border hover:border-ck-border-strong focus:border-ck-yellow focus:outline-none focus:ring-2 focus:ring-[var(--ck-focus-offset)]",
        invalid && "border-[var(--ck-danger)] focus:border-[var(--ck-danger)] focus:ring-[rgb(255_92_92_/_0.25)]",
        disabled && "cursor-not-allowed opacity-[var(--ck-opacity-muted)]",
        className,
      )}
      disabled={disabled}
      aria-invalid={invalid || undefined}
      {...props}
    >
      {children}
    </select>
  );
}
