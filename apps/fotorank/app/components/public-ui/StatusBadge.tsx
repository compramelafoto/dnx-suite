import { cn } from "../../lib/cn";
import type { StatusTone } from "../../lib/fotorank/public-ux/participant-status";

const toneClass: Record<StatusTone, string> = {
  neutral: "fr-public-badge",
  primary: "fr-public-badge fr-public-badge--primary",
  success: "fr-public-badge fr-public-badge--success",
  warning: "fr-public-badge fr-public-badge--warning",
  danger: "fr-public-badge fr-public-badge--danger",
};

type Props = {
  label: string;
  tone?: StatusTone;
  /** Text alternative when color alone is insufficient — shown as sr-only prefix. */
  stateText?: string;
  className?: string;
};

export function StatusBadge({ label, tone = "neutral", stateText, className }: Props) {
  return (
    <span className={cn(toneClass[tone], className)}>
      {stateText ? <span className="fr-public-sr-only">{stateText}. </span> : null}
      {label}
    </span>
  );
}
