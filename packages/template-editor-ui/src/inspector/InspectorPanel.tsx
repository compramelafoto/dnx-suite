"use client";

import { cn } from "../primitives/cn";

export function InspectorPanel({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-[color:var(--te-line)] bg-[color:var(--te-chrome)] p-3 shadow-sm",
        className
      )}
    >
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--te-ink-muted)]">
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function FieldLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("mb-1 block text-xs font-medium text-[color:var(--te-ink)]", className)}>
      {children}
    </span>
  );
}
