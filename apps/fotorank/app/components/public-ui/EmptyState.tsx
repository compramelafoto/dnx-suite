import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

type Props = {
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ title, description, action, className }: Props) {
  return (
    <div
      className={cn("fr-public-card mx-auto max-w-md text-center", className)}
      role="status"
      data-testid="public-empty-state"
    >
      <h2 className="fr-public-title text-xl">{title}</h2>
      <p className="fr-public-body mt-4">{description}</p>
      {action ? <div className="mt-8 flex justify-center">{action}</div> : null}
    </div>
  );
}
