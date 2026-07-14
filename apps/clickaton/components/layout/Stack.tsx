import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

const gapClass = {
  sm: "gap-3",
  md: "gap-4",
  lg: "gap-6",
  xl: "gap-8",
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
