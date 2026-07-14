import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

const toneClass = {
  default: "border-ck-border-strong bg-ck-surface text-ck-text",
  yellow: "border-ck-border-strong bg-ck-yellow text-ck-black",
  dark: "border-ck-yellow bg-ck-black text-ck-yellow",
} as const;

type IconFrameProps = HTMLAttributes<HTMLDivElement> & {
  tone?: keyof typeof toneClass;
  children: ReactNode;
  label?: string;
};

export function IconFrame({
  tone = "default",
  className,
  children,
  label,
  ...props
}: IconFrameProps) {
  return (
    <div
      className={cn(
        "inline-flex size-11 items-center justify-center rounded-[var(--ck-radius-sm)] border-2",
        toneClass[tone],
        className,
      )}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      {...props}
    >
      {children}
    </div>
  );
}
