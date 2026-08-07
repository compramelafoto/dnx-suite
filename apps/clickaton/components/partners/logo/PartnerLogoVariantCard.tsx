"use client";

import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

export type PartnerLogoPreviewKind =
  | "neutral"
  | "dark"
  | "light"
  | "horizontal"
  | "vertical"
  | "isotipo";

type Props = {
  title: string;
  description: string;
  recommendation: string;
  previewKind: PartnerLogoPreviewKind;
  required?: boolean;
  children?: ReactNode;
  className?: string;
};

/**
 * Card educativa por variante de logo (título, copy, recomendación + ilustración CSS).
 */
export function PartnerLogoVariantCard({
  title,
  description,
  recommendation,
  previewKind,
  required = false,
  children,
  className,
}: Props) {
  return (
    <Card variant="outlined" className={cn("flex flex-col gap-6 p-6 sm:p-8", className)}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-semibold tracking-tight text-ck-text">{title}</h3>
          {required ? (
            <span className="rounded-full border border-ck-yellow/40 bg-ck-yellow/10 px-2.5 py-0.5 text-xs font-medium text-ck-yellow">
              Obligatorio
            </span>
          ) : (
            <span className="rounded-full border border-ck-border px-2.5 py-0.5 text-xs text-ck-text-muted">
              Opcional
            </span>
          )}
        </div>
        <p className="text-sm leading-relaxed text-ck-text-secondary">{description}</p>
        <p className="text-xs leading-relaxed text-ck-text-muted">{recommendation}</p>
      </div>

      <LogoPreviewIllustration kind={previewKind} />

      {children ? <div className="space-y-4 border-t border-ck-border pt-6">{children}</div> : null}
    </Card>
  );
}

function LogoPreviewIllustration({ kind }: { kind: PartnerLogoPreviewKind }) {
  const frameClass = cn(
    "relative flex h-28 items-center justify-center overflow-hidden rounded-lg border border-ck-border sm:h-32",
    kind === "dark" && "bg-[#0a0a0a]",
    kind === "light" && "bg-white",
    (kind === "neutral" ||
      kind === "horizontal" ||
      kind === "vertical" ||
      kind === "isotipo") &&
      "bg-ck-surface-strong",
  );

  return (
    <div className={frameClass} aria-hidden="true">
      {kind === "horizontal" ? (
        <div className="flex w-[78%] items-center gap-3">
          <span className="size-8 shrink-0 rounded-md bg-ck-yellow/80" />
          <span className="h-3 flex-1 rounded-full bg-ck-text-muted/50" />
        </div>
      ) : null}
      {kind === "vertical" ? (
        <div className="flex flex-col items-center gap-2">
          <span className="size-10 rounded-md bg-ck-yellow/80" />
          <span className="h-2.5 w-16 rounded-full bg-ck-text-muted/50" />
          <span className="h-2 w-12 rounded-full bg-ck-text-muted/35" />
        </div>
      ) : null}
      {kind === "isotipo" ? (
        <span className="size-14 rounded-2xl border-2 border-ck-yellow/70 bg-ck-yellow/20" />
      ) : null}
      {kind === "dark" ? (
        <div className="flex items-center gap-2">
          <span className="size-8 rounded-md bg-white/90" />
          <span className="h-3 w-20 rounded-full bg-white/70" />
        </div>
      ) : null}
      {kind === "light" ? (
        <div className="flex items-center gap-2">
          <span className="size-8 rounded-md bg-neutral-900" />
          <span className="h-3 w-20 rounded-full bg-neutral-800" />
        </div>
      ) : null}
      {kind === "neutral" ? (
        <div className="flex items-center gap-2">
          <span className="size-8 rounded-md bg-ck-yellow/70" />
          <span className="h-3 w-20 rounded-full bg-ck-text-muted/45" />
        </div>
      ) : null}
    </div>
  );
}
