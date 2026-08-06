import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

type Tone = "info" | "warning" | "danger" | "success";

type Props = {
  children: ReactNode;
  tone?: Tone;
  title?: string;
  className?: string;
  role?: "status" | "alert";
  "data-testid"?: string;
};

export function Notice({
  children,
  tone = "info",
  title,
  className,
  role = "status",
  "data-testid": testId,
}: Props) {
  return (
    <div
      className={cn(
        "fr-public-notice flex flex-col gap-3",
        `fr-public-notice--${tone}`,
        className,
      )}
      role={role}
      data-testid={testId}
    >
      {title ? <p className="font-semibold text-[var(--foreground)]">{title}</p> : null}
      <div className="fr-public-body text-[0.95rem] text-[var(--foreground)]">{children}</div>
    </div>
  );
}
