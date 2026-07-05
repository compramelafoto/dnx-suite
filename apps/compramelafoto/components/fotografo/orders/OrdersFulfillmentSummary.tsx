"use client";

import {
  getOrderFulfillmentKind,
  getPickupLabel,
  isOrderPaid,
  type PhotographerOrderRow,
} from "./photographer-order-types";

export default function OrdersFulfillmentSummary({ order }: { order: PhotographerOrderRow }) {
  const fk = getOrderFulfillmentKind(order);
  const dc = order.digitalItemsCount ?? 0;
  const pc = order.printItemsCount ?? 0;
  const paid = isOrderPaid(order);

  if (fk === "DIGITAL" || (order.hasDigitalItems && !order.hasPrintItems)) {
    return (
      <div className="space-y-0.5 text-[11px] leading-snug min-w-0">
        {dc > 0 ? <p className="text-gray-600">{dc} digital{dc !== 1 ? "es" : ""}</p> : null}
        <p className={paid ? "text-emerald-700 font-medium" : "text-amber-700 font-medium"}>
          {paid ? "Descarga OK" : "Sin acreditar"}
        </p>
      </div>
    );
  }

  if (fk === "PRINT" || order.source === "PRINT_ORDER") {
    return (
      <div className="space-y-0.5 text-[11px] leading-snug min-w-0">
        <p className="text-gray-600">
          {pc > 0 ? `${pc} foto${pc !== 1 ? "s" : ""}` : `${order.itemsCount} ítem${order.itemsCount !== 1 ? "s" : ""}`}
        </p>
        {order.labName && order.labName !== "-" ? (
          <p className="text-gray-600 truncate" title={order.labName}>
            {order.labName}
          </p>
        ) : (
          <p className="text-gray-400">Sin lab</p>
        )}
        <p className="text-gray-500 truncate" title={getPickupLabel(order.pickupBy)}>
          {getPickupLabel(order.pickupBy)}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-0.5 text-[11px] leading-snug min-w-0">
      <p className="text-gray-600">
        {[dc > 0 ? `${dc}D` : null, pc > 0 ? `${pc}P` : null].filter(Boolean).join(" · ") || "Mixto"}
      </p>
      {order.labName && order.labName !== "-" ? (
        <p className="text-gray-600 truncate" title={order.labName}>
          {order.labName}
        </p>
      ) : null}
      <p className={paid ? "text-emerald-700 font-medium" : "text-amber-700 font-medium"}>
        {paid ? "Descarga OK" : "Sin acreditar"}
      </p>
    </div>
  );
}
