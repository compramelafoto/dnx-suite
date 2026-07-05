"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PhotographerWorkspacePageHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
};

export default function PhotographerWorkspacePageHeader({
  title,
  subtitle,
  actions,
  className,
}: PhotographerWorkspacePageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between w-full min-w-0 mb-6",
        className
      )}
    >
      <div className="min-w-0 flex-1">
        <h1 className="text-lg md:text-xl font-semibold text-gray-900 mb-1">{title}</h1>
        {subtitle ? (
          <p className="max-w-3xl text-sm text-gray-600 leading-relaxed ds-readable-text ds-readable-text--fluid m-0">
            {subtitle}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2 shrink-0">{actions}</div> : null}
    </header>
  );
}
