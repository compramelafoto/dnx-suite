"use client";

import { cn } from "@/lib/utils";
import type { PhotographerOrderRow } from "./photographer-order-types";
import {
  PLACEHOLDER_GRADIENTS,
  type OrderVisualData,
  type OrderVisualPlaceholderKind,
} from "./order-visual-types";

const SIZES = {
  sm: "h-11 w-11 rounded-lg",
  md: "h-[52px] w-[52px] rounded-xl",
};

function PlaceholderIcon({ kind }: { kind: OrderVisualPlaceholderKind }) {
  const className = "h-4 w-4 text-white/80 drop-shadow-sm";

  if (kind === "protected") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="5" y="10" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.75" />
        <path d="M8 10V8a4 4 0 118 0v2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    );
  }

  if (kind === "video") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="4" y="6" width="13" height="12" rx="2" stroke="currentColor" strokeWidth="1.75" />
        <path d="M17 10l4-2v8l-4-2" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="9" cy="10" r="1.5" fill="currentColor" />
      <path d="M4 16l4.5-4 3 2.5L16 10l4 4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type OrderVisualThumbnailProps = {
  order: PhotographerOrderRow;
  visual: OrderVisualData;
  size?: "sm" | "md";
  className?: string;
};

export default function OrderVisualThumbnail({
  order,
  visual,
  size = "md",
  className,
}: OrderVisualThumbnailProps) {
  const sizeClass = SIZES[size];
  const gradient = PLACEHOLDER_GRADIENTS[visual.placeholder];

  if (visual.loading && !visual.thumbUrl) {
    return (
      <div
        className={cn(
          "relative shrink-0 overflow-hidden border border-gray-200/80 bg-gray-100",
          sizeClass,
          className
        )}
        aria-hidden
      >
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-gray-100 via-gray-50 to-gray-200" />
      </div>
    );
  }

  if (visual.thumbUrl) {
    return (
      <div
        className={cn(
          "relative shrink-0 overflow-hidden border border-gray-200/80 bg-gray-100 shadow-sm",
          sizeClass,
          className
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={visual.thumbUrl}
          alt={`Vista previa pedido #${order.id}`}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
        {visual.placeholder === "protected" ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/25 backdrop-blur-[1px]">
            <PlaceholderIcon kind="protected" />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden border border-white/60 bg-gradient-to-br shadow-sm",
        gradient,
        sizeClass,
        className
      )}
      aria-hidden
    >
      <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_20%_20%,white,transparent_55%)]" />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 p-1">
        <PlaceholderIcon kind={visual.placeholder} />
        <span className="text-[9px] font-bold uppercase tracking-wide text-white/90 drop-shadow-sm">
          {visual.initials}
        </span>
      </div>
    </div>
  );
}
