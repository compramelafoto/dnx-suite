import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type DividerProps = HTMLAttributes<HTMLHRElement> & {
  tone?: "default" | "strong" | "yellow";
};

export function Divider({ tone = "default", className, ...props }: DividerProps) {
  return (
    <hr
      className={cn(
        "border-0 border-t-2",
        tone === "default" && "border-ck-border",
        tone === "strong" && "border-ck-border-strong",
        tone === "yellow" && "border-ck-yellow",
        className,
      )}
      {...props}
    />
  );
}
