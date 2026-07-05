"use client";

import type { LucideIcon } from "lucide-react";
import type { CSSProperties } from "react";

type Props = {
  icon: LucideIcon;
  title: string;
  description: string;
  variant?: "primary" | "secondary";
  accentColor?: string;
  disabled?: boolean;
  loading?: boolean;
  onClick: () => void;
};

export default function PresupuestoActionCard({
  icon: Icon,
  title,
  description,
  variant = "secondary",
  accentColor,
  disabled = false,
  loading = false,
  onClick,
}: Props) {
  const style = accentColor
    ? ({ "--cc-action-accent": accentColor } as CSSProperties)
    : undefined;

  return (
    <button
      type="button"
      className={`cc-presupuesto-action-card cc-presupuesto-action-card--${variant}`}
      style={style}
      disabled={disabled || loading}
      onClick={onClick}
      aria-busy={loading}
    >
      <span className="cc-presupuesto-action-card__icon-wrap" aria-hidden>
        <Icon className="cc-presupuesto-action-card__icon" />
      </span>
      <span className="cc-presupuesto-action-card__text">
        <span className="cc-presupuesto-action-card__title">{loading ? "Procesando…" : title}</span>
        <span className="cc-presupuesto-action-card__desc">{description}</span>
      </span>
    </button>
  );
}
