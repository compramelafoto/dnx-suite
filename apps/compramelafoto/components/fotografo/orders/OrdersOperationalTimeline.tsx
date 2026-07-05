"use client";

import OrdersActivityFeed from "./OrdersActivityFeed";
import OrdersNeedsAttention from "./OrdersNeedsAttention";
import type { OrdersQuickAutomationHandlers } from "./orders-quick-automation-helpers";
import type { PhotographerOrderRow } from "./photographer-order-types";

type OrdersOperationalTimelineProps = {
  orders: PhotographerOrderRow[];
  automationHandlers: OrdersQuickAutomationHandlers;
  onViewOrders: () => void;
};

export default function OrdersOperationalTimeline({
  orders,
  automationHandlers,
  onViewOrders,
}: OrdersOperationalTimelineProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(240px,300px)_minmax(0,1fr)] gap-3 w-full min-w-0">
      <OrdersNeedsAttention
        orders={orders}
        automationHandlers={automationHandlers}
        onViewOrders={onViewOrders}
      />
      <OrdersActivityFeed orders={orders} automationHandlers={automationHandlers} />
    </div>
  );
}
