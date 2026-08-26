"use client";

import { cn } from "@/lib/utils";

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
        "rounded-xl border border-[#e5e7eb] bg-[#fafafa] p-3 shadow-sm",
        className
      )}
    >
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[#6b7280]">
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
    <span className={cn("mb-1 block text-xs font-medium text-[#374151]", className)}>
      {children}
    </span>
  );
}
