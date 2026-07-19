import type { ElementType, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Secciones públicas transparentes sobre PageBackdrop.
 * La jerarquía visual vive en cards/contenido, no en bandas de opacidad
 * que cortan el fondo fotográfico.
 *
 * Los tonos se mantienen por API (compatibilidad), pero no pintan fills
 * distintos que generen segmentos claros/oscuros.
 */
const toneClass = {
  base: "bg-transparent text-ck-text",
  default: "bg-transparent text-ck-text",
  dark: "bg-transparent text-ck-text",
  raised: "bg-transparent text-ck-text",
  muted: "bg-transparent text-ck-text",
  elevated: "bg-transparent text-ck-text",
  yellow: "bg-transparent text-ck-text",
  accent: "bg-transparent text-ck-text",
} as const;

type SectionProps = HTMLAttributes<HTMLElement> & {
  as?: ElementType;
  tone?: keyof typeof toneClass;
  grain?: boolean;
  children: ReactNode;
};

export function Section({
  as: Tag = "section",
  tone = "default",
  grain = false,
  className,
  children,
  ...props
}: SectionProps) {
  return (
    <Tag
      className={cn(
        "py-[var(--ck-section-spacing)]",
        toneClass[tone],
        // Grain solo si se pide explícito; por defecto off para no crear bandas.
        grain && "ck-grain",
        className,
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}
