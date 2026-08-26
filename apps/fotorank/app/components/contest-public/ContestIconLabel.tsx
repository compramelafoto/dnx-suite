import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  icon: LucideIcon;
  children: ReactNode;
  className?: string;
  /** Tamaño del icono en px CSS (default 16). */
  iconSize?: number;
};

/** Ícono + texto alineados; apoyo de lectura sin ruido. */
export function ContestIconLabel({ icon: Icon, children, className, iconSize = 16 }: Props) {
  return (
    <span className={["fr-contest-icon-label", className].filter(Boolean).join(" ")}>
      <Icon
        className="fr-contest-icon-label__icon"
        width={iconSize}
        height={iconSize}
        strokeWidth={1.75}
        aria-hidden
      />
      <span className="fr-contest-icon-label__text">{children}</span>
    </span>
  );
}
