import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

type Props = {
  title: string;
  description: string;
  note?: string;
  action?: ReactNode;
  className?: string;
};

export function AdminEmptyState({ title, description, note, action, className }: Props) {
  return (
    <Card
      variant="outlined"
      className={cn("border-dashed bg-ck-surface-muted/60", className)}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ck-yellow">
        Sin datos todavía
      </p>
      <h2 className="mt-3 font-[family-name:var(--font-ck-display)] text-2xl tracking-wide text-ck-text">
        {title}
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ck-text-secondary">{description}</p>
      {note ? <p className="mt-3 max-w-2xl text-sm text-ck-text-muted">{note}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </Card>
  );
}
