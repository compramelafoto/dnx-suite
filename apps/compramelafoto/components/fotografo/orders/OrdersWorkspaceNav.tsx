"use client";

import { cn } from "@/lib/utils";
import {
  buildOrdersQuickFilters,
  countOrdersForQuickFilter,
  type OrdersQuickFilter,
  type PhotographerOrderRow,
} from "./photographer-order-types";

type OrdersWorkspaceNavProps = {
  orders: PhotographerOrderRow[];
  quickFilter: OrdersQuickFilter;
  onQuickFilterChange: (value: OrdersQuickFilter) => void;
  shownCount: number;
};

export default function OrdersWorkspaceNav({
  orders,
  quickFilter,
  onQuickFilterChange,
  shownCount,
}: OrdersWorkspaceNavProps) {
  const tabs = buildOrdersQuickFilters(orders);

  return (
    <div className="ds-action-bar flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between w-full min-w-0">
      <div className="min-w-0 flex-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div
          className="flex w-max items-center gap-0.5 p-0.5 rounded-lg bg-gray-50"
          role="tablist"
          aria-label="Filtrar pedidos"
        >
          {tabs.map((tab) => {
            const active = quickFilter === tab.value;
            const count = countOrdersForQuickFilter(orders, tab.value);
            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onQuickFilterChange(tab.value)}
                className={cn(
                  "inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2.5 py-1 text-[11px] font-medium leading-none transition-colors shrink-0",
                  active
                    ? "bg-white text-gray-900 ring-1 ring-gray-100"
                    : "text-gray-500 hover:text-gray-800 hover:bg-white/70"
                )}
              >
                {tab.label}
                <span
                  className={cn(
                    "tabular-nums rounded px-1 py-0.5 text-[9px] font-medium leading-none",
                    active ? "bg-gray-100 text-gray-600" : "bg-gray-100/60 text-gray-400"
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-gray-500 shrink-0 tabular-nums">
        Mostrando <strong className="text-gray-800">{shownCount}</strong>
      </p>
    </div>
  );
}
