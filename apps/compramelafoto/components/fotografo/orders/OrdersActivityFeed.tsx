"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  ACTIVITY_TONE_CLASSES,
  buildOrderActivityEvents,
  formatRelativeTimeEs,
  type OrderActivityEvent,
} from "./orders-activity-helpers";
import { QuickChipActions } from "./OrderDrawerQuickActions";
import {
  getEventQuickActions,
  type OrdersQuickAutomationHandlers,
} from "./orders-quick-automation-helpers";
import { rowKey, type PhotographerOrderRow } from "./photographer-order-types";

type OrdersActivityFeedProps = {
  orders: PhotographerOrderRow[];
  automationHandlers: OrdersQuickAutomationHandlers;
  className?: string;
  variant?: "default" | "compact";
};

function ActivityEventRow({
  event,
  index,
  total,
  order,
  automationHandlers,
  compact,
}: {
  event: OrderActivityEvent;
  index: number;
  total: number;
  order: PhotographerOrderRow | null;
  automationHandlers: OrdersQuickAutomationHandlers;
  compact: boolean;
}) {
  const actions = getEventQuickActions(event, order, automationHandlers);

  return (
    <li className={cn("relative pl-5", compact ? "pb-2 last:pb-0" : "pl-7 pb-3 last:pb-1")}>
      {index < total - 1 ? (
        <span
          aria-hidden
          className={cn(
            "absolute left-[7px] top-4 bottom-0 w-px bg-gray-100",
            !compact && "left-[11px]"
          )}
        />
      ) : null}

      <div className="group rounded-md px-1.5 py-1 transition-colors hover:bg-gray-50/80">
        <span
          className={cn(
            "absolute left-0 top-1.5 flex items-center justify-center rounded-full",
            compact ? "h-1.5 w-1.5" : "h-[18px] w-[18px] text-[10px] ring-1",
            ACTIVITY_TONE_CLASSES[event.tone]
          )}
          aria-hidden
        >
          {compact ? null : event.icon}
        </span>

        <div className="min-w-0 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className={cn("font-medium text-gray-800 leading-snug", compact ? "text-[11px]" : "text-xs")}>
              {event.title}
            </p>
            {!compact && event.subtitle ? (
              <p className="mt-0.5 text-[10px] text-gray-400 truncate">{event.subtitle}</p>
            ) : null}
          </div>
          <time
            className="shrink-0 text-[10px] text-gray-400 tabular-nums whitespace-nowrap"
            dateTime={event.timestamp.toISOString()}
          >
            {formatRelativeTimeEs(event.timestamp)}
          </time>
        </div>

        {actions.length > 0 ? (
          <div className={cn(compact ? "mt-1" : "mt-1.5")}>
            <QuickChipActions actions={actions} />
          </div>
        ) : null}
      </div>
    </li>
  );
}

export default function OrdersActivityFeed({
  orders,
  automationHandlers,
  className,
  variant = "default",
}: OrdersActivityFeedProps) {
  const compact = variant === "compact";
  const events = useMemo(() => buildOrderActivityEvents(orders), [orders]);
  const orderByKey = useMemo(() => {
    const map = new Map<string, PhotographerOrderRow>();
    for (const order of orders) map.set(rowKey(order), order);
    return map;
  }, [orders]);

  return (
    <div
      className={cn(
        "rounded-xl border min-w-0",
        compact
          ? "border-gray-100 bg-gray-50/40"
          : "border-gray-100 bg-white",
        className
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between gap-3 px-3 sm:px-4",
          compact ? "py-2 border-b border-gray-100/80" : "py-2.5 border-b border-gray-50"
        )}
      >
        <div className="min-w-0">
          <h2
            className={cn(
              "font-medium text-gray-700",
              compact ? "text-xs" : "text-sm font-semibold text-gray-900"
            )}
          >
            Actividad reciente
          </h2>
          {!compact ? (
            <p className="text-[11px] text-gray-500 mt-0.5">Timeline operativo</p>
          ) : null}
        </div>
        <span className="shrink-0 text-[10px] tabular-nums text-gray-400">
          {events.length}
        </span>
      </div>

      <div
        className={cn(
          "overflow-y-auto overscroll-contain px-3 sm:px-4",
          compact ? "max-h-[160px] py-1.5" : "max-h-[240px] py-2"
        )}
      >
        {events.length === 0 ? (
          <p className={cn("text-center text-gray-400", compact ? "py-4 text-[11px]" : "py-6 text-sm")}>
            Sin actividad reciente.
          </p>
        ) : (
          <ol className="relative">
            {events.map((event, index) => (
              <ActivityEventRow
                key={event.id}
                event={event}
                index={index}
                total={events.length}
                order={orderByKey.get(event.orderKey) ?? null}
                automationHandlers={automationHandlers}
                compact={compact}
              />
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
