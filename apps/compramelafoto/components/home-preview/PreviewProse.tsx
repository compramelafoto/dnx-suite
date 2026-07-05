import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Prosa centrada o alineada con ancho legible (640–760px). */
export default function PreviewProse({
  children,
  className,
  align = "center",
}: {
  children: ReactNode;
  className?: string;
  align?: "center" | "start";
}) {
  return (
    <div
      className={cn(
        "w-full max-w-[min(100%,47.5rem)] min-w-0 [text-wrap:pretty]",
        align === "center" && "mx-auto text-center",
        align === "start" && "text-left",
        className
      )}
    >
      {children}
    </div>
  );
}
