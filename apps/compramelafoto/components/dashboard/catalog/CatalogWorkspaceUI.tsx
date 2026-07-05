"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type CatalogPageHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
};

export function CatalogPageHeader({ title, subtitle, actions, className }: CatalogPageHeaderProps) {
  return (
    <header className={cn("ds-catalog-header", className)}>
      <div className="ds-catalog-header__text">
        <h1 className="ds-catalog-title">{title}</h1>
        {subtitle ? <p className="ds-catalog-subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="ds-catalog-header__actions">{actions}</div> : null}
    </header>
  );
}

type SegmentTab<T extends string> = { id: T; label: string };

type CatalogSegmentTabsProps<T extends string> = {
  tabs: SegmentTab<T>[];
  activeId: T;
  onChange: (id: T) => void;
  ariaLabel: string;
  className?: string;
};

export function CatalogSegmentTabs<T extends string>({
  tabs,
  activeId,
  onChange,
  ariaLabel,
  className,
}: CatalogSegmentTabsProps<T>) {
  return (
    <div className={cn("ds-catalog-segment-tabs", className)} role="tablist" aria-label={ariaLabel}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeId === tab.id}
          onClick={() => onChange(tab.id)}
          className="ds-catalog-segment-tab"
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

type StatusTab<T extends string> = { id: T; label: string; count?: number };

type CatalogStatusPillsProps<T extends string> = {
  tabs: StatusTab<T>[];
  activeId: T;
  onChange: (id: T) => void;
  ariaLabel: string;
};

export function CatalogStatusPills<T extends string>({
  tabs,
  activeId,
  onChange,
  ariaLabel,
}: CatalogStatusPillsProps<T>) {
  return (
    <div className="ds-catalog-toolbar__status" role="tablist" aria-label={ariaLabel}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeId === tab.id}
          onClick={() => onChange(tab.id)}
          className="ds-catalog-status-pill"
        >
          <span>{tab.label}</span>
          {typeof tab.count === "number" ? (
            <span className="tabular-nums text-[#9ca3af]">({tab.count})</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

export function CatalogToolbar({
  children,
  meta,
  className,
}: {
  children: ReactNode;
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("ds-catalog-toolbar ds-card", className)}>
      {children}
      {meta ? <p className="ds-catalog-toolbar__meta">{meta}</p> : null}
    </div>
  );
}

export function CatalogCardGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("ds-catalog-card-grid", className)}>{children}</div>;
}

export function CatalogWorkspaceSection({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={cn("ds-catalog-section", className)}>{children}</section>;
}
