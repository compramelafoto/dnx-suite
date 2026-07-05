"use client";

import { isDataProtected, type PhotographerOrderRow } from "./photographer-order-types";

export default function OrdersCustomerBlock({ order }: { order: PhotographerOrderRow }) {
  const protectedData = isDataProtected(order);

  if (protectedData) {
    return (
      <div className="min-w-0 max-w-[200px]">
        <p className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-[11px] font-semibold leading-none text-amber-900 ring-1 ring-amber-200/70 whitespace-nowrap">
          <span aria-hidden>🔒</span>
          Datos protegidos
        </p>
        <p className="mt-0.5 text-[10px] text-gray-400 leading-none">Hasta acreditación</p>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-0.5">
      <p className="text-xs font-semibold text-gray-900 truncate leading-tight">
        {order.customerName || "Sin nombre"}
      </p>
      {order.customerEmail ? (
        <p className="text-[10px] text-gray-500 truncate leading-none" title={order.customerEmail}>
          {order.customerEmail}
        </p>
      ) : null}
      {order.customerPhone ? (
        <p className="text-[10px] text-gray-400 whitespace-nowrap leading-none">{order.customerPhone}</p>
      ) : null}
    </div>
  );
}
