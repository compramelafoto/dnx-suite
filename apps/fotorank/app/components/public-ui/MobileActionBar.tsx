import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  "aria-label"?: string;
};

export function MobileActionBar({ children, "aria-label": ariaLabel = "Acción principal" }: Props) {
  return (
    <div className="fr-public-mobile-bar" data-testid="mobile-action-bar">
      <div className="mx-auto flex max-w-[var(--container-width)] items-center justify-stretch gap-3">
        <div className="w-full" role="region" aria-label={ariaLabel}>
          {children}
        </div>
      </div>
    </div>
  );
}
