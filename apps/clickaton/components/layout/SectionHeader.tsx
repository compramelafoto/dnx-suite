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
};

export function SectionHeader({
  eyebrow,
  title,
  description,
  align = "left",
  titleId,
  className,
  action,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        align === "center" && "items-center text-center",
        Boolean(action) && "sm:flex-row sm:items-end sm:justify-between sm:gap-8",
        Boolean(action) && align === "center" && "sm:flex-col sm:items-center",
        className,
      )}
    >
      <div className={cn("max-w-[var(--ck-content-readable)]", align === "center" && "mx-auto")}>
        {eyebrow ? <p className="ck-label text-ck-text-secondary">{eyebrow}</p> : null}
        <h2 id={titleId} className={cn("ck-display-md", eyebrow && "mt-3")}>
          {title}
        </h2>
        {description ? (
          <p className="ck-body-lg mt-4 text-ck-text-secondary">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
