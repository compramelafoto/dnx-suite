import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import PreviewProse from "@/components/home-preview/PreviewProse";

type SectionSplitProps = {
  children: ReactNode;
  visual: ReactNode;
  reverse?: boolean;
  className?: string;
};

/** Layout dos columnas: copy + visual (mobile: visual arriba). */
export default function SectionSplit({ children, visual, reverse, className }: SectionSplitProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center w-full min-w-0",
        className
      )}
    >
      <div
        className={cn(
          "min-w-0 w-full order-2",
          reverse ? "lg:order-2" : "lg:order-1"
        )}
      >
        <PreviewProse align="start" className="mx-0 max-w-[min(100%,40rem)]">
          {children}
        </PreviewProse>
      </div>
      <div
        className={cn(
          "min-w-0 w-full max-w-xl mx-auto lg:max-w-none order-1",
          reverse ? "lg:order-1" : "lg:order-2"
        )}
      >
        {visual}
      </div>
    </div>
  );
}
