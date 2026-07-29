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
  base: "bg-[var(--ck-surface-base)] text-ck-text",
  default: "bg-[var(--ck-surface-base)] text-ck-text",
  dark: "bg-[var(--ck-surface-base)] text-ck-text",
  raised: "bg-[var(--ck-surface-raised)] text-ck-text",
  muted: "bg-[var(--ck-surface-raised)] text-ck-text",
  elevated: "bg-[var(--ck-surface-band)] text-ck-text",
  yellow: "bg-[var(--ck-surface-band)] text-ck-text",
  accent: "bg-[var(--ck-community-soft)] text-ck-text",
} as const;

type SectionProps = HTMLAttributes<HTMLElement> & {
  as?: ElementType;
  tone?: keyof typeof toneClass;
  grain?: boolean;
  /** Si es true, no aplica el padding vertical de sección (útil en heroes a viewport). */
  flush?: boolean;
  children: ReactNode;
};

export function Section({
  as: Tag = "section",
  tone = "default",
  grain = false,
  flush = false,
  className,
  children,
  ...props
}: SectionProps) {
  return (
    <Tag
      className={cn(
        !flush && "py-[var(--ck-section-spacing)]",
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
