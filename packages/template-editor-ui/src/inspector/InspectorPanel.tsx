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
        "border-b border-[color:var(--te-line)] px-3 py-2.5",
        className
      )}
    >
      <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[color:var(--te-ink-muted)]">
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
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
    <span className={cn("mb-0.5 block text-[11px] text-[color:var(--te-ink-muted)]", className)}>
      {children}
    </span>
  );
}
