import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

type Props = {
  title: string;
  titleId?: string;
  eyebrow?: string;
  description?: string;
  action?: ReactNode;
  align?: "left" | "center";
  className?: string;
};

/**
 * Cabecera de sección pública.
 * Ritmo: eyebrow → título (20px) → descripción (20px).
 * El contenido siguiente debe usar `.fr-public-stack-content` (40px).
 */
export function PublicSectionHeader({
  title,
  titleId,
  eyebrow,
  description,
  action,
  align = "left",
  className,
}: Props) {
  return (
    <div
      className={cn(
        "flex flex-col",
        align === "center" && "items-center text-center",
        Boolean(action) && "sm:flex-row sm:items-end sm:justify-between sm:gap-8",
        className,
      )}
    >
      <div className={cn("max-w-2xl", align === "center" && "mx-auto")}>
        {eyebrow ? <p className="fr-public-eyebrow">{eyebrow}</p> : null}
        <h2
          id={titleId}
          className={cn(
            "fr-public-title text-2xl md:text-3xl",
            eyebrow && "fr-public-stack-title",
          )}
        >
          {title}
        </h2>
        {description ? (
          <p className="fr-public-body fr-public-stack-title text-base md:text-lg">{description}</p>
        ) : null}
      </div>
      {action ? <div className="mt-6 shrink-0 sm:mt-0">{action}</div> : null}
    </div>
  );
}
