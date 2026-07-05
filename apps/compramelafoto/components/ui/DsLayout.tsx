"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Shell de página alineado al `container-custom` legacy + helpers DS (`ds-page-shell`, `ds-fill-width`).
 * Usar en paneles tipo fotógrafo/lab para heredar min-width:0 y padding horizontal consistente.
 *
 * Páginas `/cuenta/*` bajo Header público: preferir `AccountPageShell` (`@/components/layout/AccountPageShell`).
 */
export function DsPageShell({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("container-custom ds-page-shell ds-fill-width", className)}>{children}</div>;
}

/** Columna central máx. `var(--ds-dashboard-inner-max)` — equiv. max-w-7xl con min-w-0. */
export function DsDashboardInner({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("ds-dashboard-inner", className)}>{children}</div>;
}

/** Shell ancho para Ventas / Productos / Templates (usa todo el workspace ~max-w-7xl). */
export function DsCatalogShell({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("ds-catalog-shell", className)}>{children}</div>;
}

/**
 * Contenido bajo `Tabs` o secciones flex: stretch + gap + hijos con min-w-0.
 * Sustituye `flex w-full min-w-0 max-w-full flex-col gap-*` repetido.
 */
export function DsTabPanel({
  children,
  className,
  density = "default",
}: {
  children: ReactNode;
  className?: string;
  /** `relaxed` ≈ gap mayor (antes gap-8). */
  density?: "default" | "relaxed";
}) {
  return (
    <div
      className={cn("ds-tab-panel", density === "relaxed" && "ds-tab-panel--lg", className)}
    >
      {children}
    </div>
  );
}

/** Banda informativa con tipografía y ancho de prosa del DS. */
export function DsInfoPanel({
  title,
  children,
  className,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("ds-info-panel", className)} role="note">
      {title ? <p className="ds-info-panel__title">{title}</p> : null}
      <div className="ds-info-panel__body">{children}</div>
    </div>
  );
}
