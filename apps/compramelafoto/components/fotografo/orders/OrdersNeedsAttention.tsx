"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { buildOrdersAttentionSummary } from "./orders-activity-helpers";
import { QuickChipActions } from "./OrderDrawerQuickActions";
import {
  getAttentionQuickActions,
  type OrdersQuickAutomationHandlers,
} from "./orders-quick-automation-helpers";
import OrdersQuickActionChip from "./OrdersQuickActionChip";
import type { PhotographerOrderRow } from "./photographer-order-types";

type OrdersNeedsAttentionProps = {
  orders: PhotographerOrderRow[];
  automationHandlers: OrdersQuickAutomationHandlers;
  onViewOrders: () => void;
  className?: string;
};

const TONE_STYLES = {
  amber: "border-l-amber-400 bg-amber-50/50",
  orange: "border-l-orange-400 bg-orange-50/50",
  sky: "border-l-sky-400 bg-sky-50/50",
  rose: "border-l-rose-400 bg-rose-50/50",
} as const;

export default function OrdersNeedsAttention({
  orders,
  automationHandlers,
  onViewOrders,
  className,
}: OrdersNeedsAttentionProps) {
  const summary = useMemo(() => buildOrdersAttentionSummary(orders), [orders]);

  return (
    <div
      className={cn(
        "rounded-xl border border-gray-100 bg-white min-w-0",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3 px-3 py-2.5 sm:px-4 border-b border-gray-50">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-gray-900">Requiere atención</h2>
          <p className="text-[11px] text-gray-500 mt-0.5">
            {summary.totalCount > 0
              ? `${summary.totalCount} situación${summary.totalCount === 1 ? "" : "es"} pendiente${summary.totalCount === 1 ? "" : "s"}`
              : "Todo al día"}
          </p>
        </div>
        {summary.totalCount > 0 ? (
          <span className="shrink-0 text-xs font-semibold tabular-nums text-amber-700">
            {summary.totalCount}
          </span>
        ) : (
          <span className="shrink-0 text-xs font-medium text-emerald-600">OK</span>
        )}
      </div>

      <div className="px-3 py-2.5 sm:px-4 space-y-1.5">
        {summary.items.length === 0 ? (
          <p className="text-xs text-gray-500 leading-relaxed py-1">
            No hay pendientes críticos en este momento.
          </p>
        ) : (
          summary.items.map((item) => (
            <div
              key={item.id}
              className={cn(
                "rounded-lg border-l-[3px] border border-gray-100 px-2.5 py-2 space-y-1.5",
                TONE_STYLES[item.tone]
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-gray-800">{item.label}</span>
                <span className="text-xs font-semibold tabular-nums text-gray-700">{item.count}</span>
              </div>
              <QuickChipActions actions={getAttentionQuickActions(item, automationHandlers)} />
            </div>
          ))
        )}

        <OrdersQuickActionChip
          label="Ver pedidos"
          variant="default"
          className="mt-0.5 w-full justify-center !rounded-md !px-3 !py-1.5 !text-[11px]"
          onClick={onViewOrders}
        />
      </div>
    </div>
  );
}
