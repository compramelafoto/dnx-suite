import type { ReactNode } from "react";

export type PageInfoRecuadroVariant =
  | "default"
  | "warning"
  /** Aviso menos intenso (p. ej. sin datos aún) */
  | "warningSoft"
  | "danger"
  /** Bloque “próximamente” u outline suave */
  | "placeholder";

export type PageInfoRecuadroDensity = "comfortable" | "compact";

export interface PageInfoRecuadroProps {
  variant?: PageInfoRecuadroVariant;
  /** `comfortable`: gap 32px entre hijos (texto → CTA). `compact`: 12px (metadatos densos). */
  density?: PageInfoRecuadroDensity;
  className?: string;
  children: ReactNode;
}

const VARIANT_CLASS: Record<PageInfoRecuadroVariant, string> = {
  default: "border-[#262626] bg-[#141414]",
  warning: "border-amber-500/30 bg-amber-500/5",
  warningSoft: "border-amber-500/25 bg-amber-500/5",
  danger: "border-red-500/30 bg-red-500/5",
  placeholder: "border-dashed border-[#262626] bg-[#141414]",
};

const DENSITY_GAP: Record<PageInfoRecuadroDensity, string> = {
  comfortable: "gap-8",
  compact: "gap-3",
};

/**
 * Recuadro de contenido bajo `PageContainer`: sangría (`fr-recuadro`), borde, ritmo vertical.
 * Texto: preferí `.fr-body` / `.fr-body-small` en los hijos; CTAs `w-fit` al final.
 */
export function PageInfoRecuadro({
  variant = "default",
  density = "comfortable",
  className = "",
  children,
}: PageInfoRecuadroProps) {
  const classes = [
    "fr-recuadro flex flex-col rounded-xl border",
    VARIANT_CLASS[variant],
    DENSITY_GAP[density],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return <div className={classes}>{children}</div>;
}
