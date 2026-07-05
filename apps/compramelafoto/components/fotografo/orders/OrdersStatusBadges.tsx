"use client";

import { cn } from "@/lib/utils";
import { getOperationalStatusGroups, type PhotographerOrderRow } from "./photographer-order-types";

const PRIMARY_TONE = {
  amber: "bg-amber-50/80 text-amber-900",
  emerald: "bg-emerald-50/80 text-emerald-900",
  blue: "bg-blue-50/80 text-blue-900",
  violet: "bg-violet-50/80 text-violet-900",
  gray: "bg-gray-100 text-gray-700",
  red: "bg-red-50/80 text-red-800",
};

const MAX_SECONDARY = 1;

export default function OrdersStatusBadges({ order }: { order: PhotographerOrderRow }) {
  const { primary, secondary } = getOperationalStatusGroups(order);

  if (!primary) {
    return <span className="text-[10px] text-gray-400 leading-none">—</span>;
  }

  const visibleSecondary = secondary.slice(0, MAX_SECONDARY);
  const hiddenCount = secondary.length - visibleSecondary.length;
  const hiddenTitle = secondary.slice(MAX_SECONDARY).map((s) => s.label).join(" · ");

  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span
        className={cn(
          "inline-flex w-fit max-w-full items-center rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none whitespace-nowrap",
          PRIMARY_TONE[primary.tone]
        )}
      >
        <span className="truncate">{primary.label}</span>
      </span>

      {(visibleSecondary.length > 0 || hiddenCount > 0) && (
        <div className="flex flex-wrap items-center gap-1 min-w-0">
          {visibleSecondary.map((s) => (
            <span
              key={`${s.icon}-${s.label}`}
              title={s.label}
              className="inline-flex max-w-[140px] items-center rounded px-1 py-0.5 text-[10px] font-medium leading-none text-gray-500 bg-gray-50 whitespace-nowrap"
            >
              <span className="truncate">{s.label}</span>
            </span>
          ))}
          {hiddenCount > 0 ? (
            <span
              title={hiddenTitle}
              className="inline-flex items-center rounded px-1 py-0.5 text-[10px] font-medium leading-none text-gray-400 bg-gray-50 whitespace-nowrap cursor-default"
            >
              +{hiddenCount}
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}
