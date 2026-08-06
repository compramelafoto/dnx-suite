import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

type Props = {
  label: string;
  value: ReactNode;
  hint?: string;
  className?: string;
  accent?: boolean;
};

export function InfoCard({ label, value, hint, className, accent }: Props) {
  return (
    <div className={cn("fr-public-card", accent && "fr-public-card--accent", className)}>
      <p className="fr-public-eyebrow text-[0.7rem]">{label}</p>
      <p className="text-lg font-semibold tracking-tight text-[var(--foreground)]">{value}</p>
      {hint ? <p className="fr-public-body text-sm">{hint}</p> : null}
    </div>
  );
}
