import type { ElementType, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Alternancia editorial V2:
 * - base / default / dark → fondo página
 * - raised / muted → banda ligeramente elevada
 * - elevated / yellow → superficie card-like de sección
 * - accent → tinte comunidad (uso puntual)
 * `yellow` nunca es fill amarillo.
 */
const toneClass = {
  base: "bg-transparent text-ck-text",
  default: "bg-transparent text-ck-text",
  dark: "bg-transparent text-ck-text",
  raised: "bg-[rgb(21_21_21_/_0.68)] text-ck-text",
  muted: "bg-[rgb(21_21_21_/_0.68)] text-ck-text",
  elevated: "bg-[rgb(34_34_34_/_0.74)] text-ck-text",
  yellow: "bg-[rgb(34_34_34_/_0.74)] text-ck-text",
  accent: "bg-[color-mix(in_srgb,var(--ck-community-soft)_78%,transparent)] text-ck-text",
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
        grain && "ck-grain",
        className,
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}
