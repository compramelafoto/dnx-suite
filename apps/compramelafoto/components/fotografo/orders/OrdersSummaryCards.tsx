"use client";

import { cn } from "@/lib/utils";
import type { OrdersQuickFilter, OrdersWorkspaceStats } from "./photographer-order-types";

type OrdersSummaryCardsProps = {
  stats: OrdersWorkspaceStats;
  activeFilter: OrdersQuickFilter;
  onSelectFilter: (filter: OrdersQuickFilter) => void;
};

type CardKey = keyof OrdersWorkspaceStats;

const CARDS: {
  key: CardKey;
  label: string;
  filter: OrdersQuickFilter;
  accent: string;
}[] = [
  { key: "total", label: "Total", filter: "ALL", accent: "text-gray-900" },
  { key: "pending", label: "Pendientes", filter: "PENDING", accent: "text-amber-700" },
  { key: "paid", label: "Pagados", filter: "PAID", accent: "text-emerald-700" },
  { key: "downloadsAvailable", label: "Descargas", filter: "DIGITAL", accent: "text-sky-700" },
  { key: "printPending", label: "Impresión", filter: "PRINT", accent: "text-orange-700" },
];

export default function OrdersSummaryCards({
  stats,
  activeFilter,
  onSelectFilter,
}: OrdersSummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 w-full min-w-0">
      {CARDS.map((card) => {
        const active = activeFilter === card.filter;
        return (
          <button
            key={card.key}
            type="button"
            onClick={() => onSelectFilter(card.filter)}
            className={cn(
              "group flex min-h-[72px] min-w-0 flex-col justify-between rounded-lg border bg-white px-3 py-2.5 text-left",
              "transition-colors duration-100",
              active
                ? "border-[#c27b3d]/40 bg-[#c27b3d]/[0.04] ring-1 ring-[#c27b3d]/15"
                : "border-gray-100 hover:border-gray-200 hover:bg-gray-50/50"
            )}
          >
            <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-gray-400 leading-tight">
              {card.label}
            </p>
            <p className={cn("tabular-nums text-2xl font-semibold leading-none mt-2", card.accent)}>
              {stats[card.key]}
            </p>
          </button>
        );
      })}
    </div>
  );
}
