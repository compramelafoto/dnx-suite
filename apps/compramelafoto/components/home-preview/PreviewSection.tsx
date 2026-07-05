import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PreviewSectionProps = {
  id?: string;
  children: ReactNode;
  className?: string;
  /** Fondo alternativo entre secciones */
  variant?: "default" | "muted" | "accent";
};

const VARIANT_CLASS = {
  default: "bg-white",
  muted: "bg-[#f9fafb]",
  accent: "bg-[#f7f5f2]",
} as const;

export default function PreviewSection({
  id,
  children,
  className,
  variant = "default",
}: PreviewSectionProps) {
  return (
    <section
      id={id}
      className={cn(
        "section-spacing w-full min-w-0 overflow-x-hidden",
        id && "scroll-mt-24",
        VARIANT_CLASS[variant],
        className
      )}
    >
      <div className="container-custom min-w-0 w-full">{children}</div>
    </section>
  );
}
