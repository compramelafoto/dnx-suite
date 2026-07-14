import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type SectionHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  titleId?: string;
  className?: string;
  action?: ReactNode;
  /** En secciones oscuras / amarillas / accent. */
  tone?: "default" | "inverse" | "onBrand";
};

export function SectionHeader({
  eyebrow,
  title,
  description,
  align = "left",
  titleId,
  className,
  action,
  tone = "default",
}: SectionHeaderProps) {
  const eyebrowClass =
    tone === "inverse"
      ? "ck-overline text-ck-yellow"
      : tone === "onBrand"
        ? "ck-overline text-ck-black/70"
        : "ck-overline text-ck-text-muted";

  const titleClass =
    tone === "inverse"
      ? "ck-display-md text-ck-yellow"
      : "ck-display-md text-ck-text";

  const descriptionClass =
    tone === "inverse"
      ? "ck-body-lg text-ck-gray-200"
      : "ck-body-lg text-ck-text-secondary";

  return (
    <div
      className={cn(
        "flex flex-col",
        align === "center" && "items-center text-center",
        Boolean(action) && "sm:flex-row sm:items-end sm:justify-between sm:gap-8",
        Boolean(action) && align === "center" && "sm:flex-col sm:items-center",
        className,
      )}
    >
      <div className={cn("max-w-[var(--ck-content-readable)]", align === "center" && "mx-auto")}>
        {eyebrow ? <p className={eyebrowClass}>{eyebrow}</p> : null}
        <h2
          id={titleId}
          className={cn(titleClass, eyebrow && "mt-[var(--ck-stack-title-to-subtitle)]")}
        >
          {title}
        </h2>
        {description ? (
          <p
            className={cn(
              descriptionClass,
              "mt-[var(--ck-stack-title-to-subtitle)]",
            )}
          >
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
