import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

type Props = {
  title?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

export function AdminForm({ title, description, children, footer, className }: Props) {
  return (
    <Card variant="outlined" className={cn("space-y-6 p-5 sm:p-6", className)}>
      {title ? (
        <div className="space-y-1">
          <h2 className="font-[family-name:var(--font-ck-display)] text-xl tracking-wide text-ck-text">
            {title}
          </h2>
          {description ? <p className="text-sm text-ck-text-secondary">{description}</p> : null}
        </div>
      ) : null}
      <div className="grid gap-5 md:grid-cols-2">{children}</div>
      {footer ? <div className="flex flex-wrap gap-3 border-t border-ck-border pt-5">{footer}</div> : null}
    </Card>
  );
}

export function AdminFormSection({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("md:col-span-2 space-y-4", className)}>
      <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-ck-yellow">{title}</h3>
      <div className="grid gap-5 md:grid-cols-2">{children}</div>
    </div>
  );
}

export function AdminFormFullWidth({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("md:col-span-2", className)}>{children}</div>;
}
