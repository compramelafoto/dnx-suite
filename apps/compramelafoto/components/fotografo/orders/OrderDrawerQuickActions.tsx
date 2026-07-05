"use client";

import OrdersQuickActionChip, {
  OrdersQuickActionLink,
  OrdersQuickActionsRow,
} from "./OrdersQuickActionChip";
import {
  getOrderDrawerQuickActions,
  type OrdersQuickAutomationHandlers,
  type QuickChipAction,
} from "./orders-quick-automation-helpers";
import type { PhotographerOrderRow } from "./photographer-order-types";

export function QuickChipActions({ actions }: { actions: QuickChipAction[] }) {
  if (actions.length === 0) return null;

  return (
    <OrdersQuickActionsRow>
      {actions.map((action) =>
        action.href ? (
          <OrdersQuickActionLink
            key={action.id}
            href={action.href}
            label={action.label}
            variant={action.variant}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <OrdersQuickActionChip
            key={action.id}
            label={action.label}
            variant={action.variant}
            disabled={action.disabled}
            onClick={(e) => {
              e.stopPropagation();
              action.run?.();
            }}
          />
        )
      )}
    </OrdersQuickActionsRow>
  );
}

type OrderDrawerQuickActionsProps = {
  order: PhotographerOrderRow;
  handlers: OrdersQuickAutomationHandlers;
};

export default function OrderDrawerQuickActions({ order, handlers }: OrderDrawerQuickActionsProps) {
  const actions = getOrderDrawerQuickActions(order, handlers);
  if (actions.length === 0) return null;

  return (
    <section className="ds-stack-section gap-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 leading-none">
        Acciones rápidas
      </h3>
      <div className="ds-card rounded-lg border border-gray-100 bg-gray-50/50 p-2.5">
        <QuickChipActions actions={actions} />
      </div>
    </section>
  );
}
