"use client";

import { cn } from "@/lib/utils";
import { formatCollaborativeEventMoneyPesos } from "@/lib/event-organizer-commission-display";
import { CollaborativeEventOrganizerBadge } from "@/components/sales/CollaborativeEventSaleBreakdown";
import {
  getPaymentStatusLabel,
  isOrderPaid,
  type PhotographerOrderRow,
} from "./photographer-order-types";

type OrdersAmountColumnProps = {
  order: PhotographerOrderRow;
  hasEventSale?: boolean;
  received?: number;
  expandedSaleOrderId?: number | null;
  onToggleSaleDetail?: (orderId: number) => void;
  align?: "left" | "right";
};

export default function OrdersAmountColumn({
  order,
  hasEventSale = false,
  received,
  expandedSaleOrderId,
  onToggleSaleDetail,
  align = "right",
}: OrdersAmountColumnProps) {
  const paymentLabel = getPaymentStatusLabel(order);
  const paid = isOrderPaid(order);
  const alignClass = align === "right" ? "text-right items-end" : "text-left items-start";

  return (
    <div className={cn("flex flex-col gap-0.5 min-w-0", alignClass)}>
      <p
        className={cn(
          "text-[10px] font-medium leading-none whitespace-nowrap",
          paid ? "text-emerald-700" : paymentLabel === "Reembolsado" ? "text-red-600" : "text-amber-600"
        )}
      >
        {paymentLabel}
      </p>

      {hasEventSale && received != null ? (
        <>
          <CollaborativeEventOrganizerBadge className={align === "right" ? "self-end" : "self-start"} />
          <p className="text-xs font-bold text-gray-900 tabular-nums whitespace-nowrap leading-tight">
            {formatCollaborativeEventMoneyPesos(received)}
          </p>
          {onToggleSaleDetail ? (
            <button
              type="button"
              className="text-[10px] text-[#c27b3d] underline whitespace-nowrap leading-none"
              onClick={() => onToggleSaleDetail(order.id)}
            >
              {expandedSaleOrderId === order.id ? "Ocultar" : "Desglose"}
            </button>
          ) : null}
        </>
      ) : (
        <p className="text-xs font-bold text-gray-900 tabular-nums whitespace-nowrap leading-tight">
          {order.currency} {order.total.toLocaleString("es-AR")}
        </p>
      )}
    </div>
  );
}
