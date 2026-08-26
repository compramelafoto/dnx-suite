import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

type Props = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({ eyebrow, title, description, actions, className }: Props) {
  return (
    <header
      className={cn(
        "flex flex-col border-b border-[var(--border)] pb-10 md:flex-row md:items-end md:justify-between md:gap-8",
        className,
      )}
    >
      <div className="min-w-0 max-w-2xl">
        {eyebrow ? <p className="fr-public-eyebrow">{eyebrow}</p> : null}
        <h1
          className={cn(
            "fr-public-title text-3xl md:text-4xl",
            eyebrow && "fr-public-stack-title",
          )}
        >
          {title}
        </h1>
        {description ? (
          <p className="fr-public-body fr-public-stack-title text-base md:text-lg">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="mt-[var(--public-stack-subtitle-to-content)] flex flex-wrap gap-3 md:mt-0 md:justify-end">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
