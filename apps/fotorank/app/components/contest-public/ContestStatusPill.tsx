import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type Tone = "accent" | "muted" | "success" | "warning";

type Props = {
  children: ReactNode;
  tone?: Tone;
  icon?: LucideIcon;
  className?: string;
};

/** Pill/badge de estado con icono opcional. */
export function ContestStatusPill({ children, tone = "accent", icon: Icon, className }: Props) {
  return (
    <span
      className={[
        "fr-contest-badge",
        tone === "muted" && "fr-contest-badge--muted",
        tone === "success" && "fr-contest-badge--success",
        tone === "warning" && "fr-contest-badge--warning",
        Icon && "fr-contest-badge--with-icon",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {Icon ? (
        <Icon className="fr-contest-badge__icon" width={14} height={14} strokeWidth={2} aria-hidden />
      ) : null}
      {children}
    </span>
  );
}
