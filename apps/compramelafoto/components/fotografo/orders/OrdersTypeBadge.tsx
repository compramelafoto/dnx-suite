"use client";

import { cn } from "@/lib/utils";
import {
  getOrderTypeBadgeVariant,
  type PhotographerOrderRow,
  type OrderTypeBadgeVariant,
} from "./photographer-order-types";

const BADGE_STYLES: Record<OrderTypeBadgeVariant, string> = {
  DIGITAL: "bg-sky-50 text-sky-700 ring-sky-200/80",
  PRINT: "bg-orange-50 text-orange-800 ring-orange-200/80",
  MIXED: "bg-violet-50 text-violet-800 ring-violet-200/80",
  PREVENTA: "bg-amber-50 text-amber-800 ring-amber-200/80",
  VIDEO: "bg-fuchsia-50 text-fuchsia-800 ring-fuchsia-200/80",
};

const BADGE_LABELS: Record<OrderTypeBadgeVariant, string> = {
  DIGITAL: "DIG",
  PRINT: "IMP",
  MIXED: "MIX",
  PREVENTA: "PRE",
  VIDEO: "VID",
};

const BADGE_TITLES: Record<OrderTypeBadgeVariant, string> = {
  DIGITAL: "Digital",
  PRINT: "Impresión",
  MIXED: "Mixto",
  PREVENTA: "Preventa",
  VIDEO: "Video",
};

export default function OrdersTypeBadge({ order }: { order: PhotographerOrderRow }) {
  const variant = getOrderTypeBadgeVariant(order);

  return (
    <span
      title={BADGE_TITLES[variant]}
      className={cn(
        "inline-flex items-center rounded px-1 py-0.5 text-[10px] font-semibold tracking-wide leading-none whitespace-nowrap",
        BADGE_STYLES[variant]
      )}
    >
      {BADGE_LABELS[variant]}
    </span>
  );
}
