import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Ritmo vertical tipado al DS (`--ck-stack-*` / `--ck-space-*`).
 */
const gapClass = {
  sm: "gap-[var(--ck-space-3)]",
  md: "gap-[var(--ck-stack-title-to-subtitle)]",
  lg: "gap-[var(--ck-stack-subtitle-to-content)]",
  xl: "gap-[var(--ck-stack-block)]",
  section: "gap-[var(--ck-stack-section)]",
} as const;

type StackProps = HTMLAttributes<HTMLDivElement> & {
  gap?: keyof typeof gapClass;
  children: ReactNode;
};

export function Stack({ gap = "md", className, children, ...props }: StackProps) {
  return (
    <div className={cn("flex flex-col", gapClass[gap], className)} {...props}>
      {children}
    </div>
  );
}
