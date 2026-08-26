import type { LucideIcon } from "lucide-react";
import type { CategoryInfoBadgeTone } from "../../lib/fotorank/contest-public-presentation";

type Props = {
  label: string;
  tone?: CategoryInfoBadgeTone | "default";
  icon?: LucideIcon;
};

/** Badge informativo (no botón): dispositivo, docs, límite, etc. */
export function ContestInfoBadge({ label, tone = "default", icon: Icon }: Props) {
  return (
    <span className={`fr-contest-info-badge fr-contest-info-badge--${tone}`}>
      {Icon ? (
        <Icon className="fr-contest-info-badge__icon" width={13} height={13} strokeWidth={2} aria-hidden />
      ) : null}
      <span>{label}</span>
    </span>
  );
}
