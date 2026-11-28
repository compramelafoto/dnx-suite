"use client";

import { sinPedidosDemo } from "@/lib/canje-externo/pack-de-prueba";

import OrdersSummaryCards from "./OrdersSummaryCards";
import OrdersWorkspaceNav from "./OrdersWorkspaceNav";
import OrdersSearchBar from "./OrdersSearchBar";
import OrdersDateRangeBar from "./OrdersDateRangeBar";
import {
  computeOrdersWorkspaceStats,
  type OrdersQuickFilter,
  type PhotographerOrderRow,
} from "./photographer-order-types";

type OrdersWorkspaceHeaderProps = {
  orders: PhotographerOrderRow[];
  quickFilter: OrdersQuickFilter;
  onQuickFilterChange: (value: OrdersQuickFilter) => void;
  q: string;
  onSearchChange: (value: string) => void;
  onClearSearch: () => void;
  shownCount: number;
  desde: string;
  hasta: string;
  onDesdeChange: (value: string) => void;
  onHastaChange: (value: string) => void;
  onClearDates: () => void;
};

export default function OrdersWorkspaceHeader({
  orders,
  quickFilter,
  onQuickFilterChange,
  q,
  onSearchChange,
  onClearSearch,
  shownCount,
  desde,
  hasta,
  onDesdeChange,
  onHastaChange,
  onClearDates,
}: OrdersWorkspaceHeaderProps) {
  // Los pedidos DEMO (pruebas del fotógrafo) se listan pero no cuentan.
  const stats = computeOrdersWorkspaceStats(sinPedidosDemo(orders));

  return (
    <div className="flex flex-col gap-2.5 w-full min-w-0">
      <OrdersSummaryCards
        stats={stats}
        activeFilter={quickFilter}
        onSelectFilter={onQuickFilterChange}
      />

      <div className="rounded-lg border border-gray-100 bg-white p-2.5 sm:p-3 flex flex-col gap-2.5">
        <OrdersWorkspaceNav
          orders={orders}
          quickFilter={quickFilter}
          onQuickFilterChange={onQuickFilterChange}
          shownCount={shownCount}
        />
        <OrdersSearchBar
          q={q}
          onSearchChange={onSearchChange}
          onClear={onClearSearch}
          hasActiveSearch={q.trim().length > 0}
        />
        <OrdersDateRangeBar
          desde={desde}
          hasta={hasta}
          onDesdeChange={onDesdeChange}
          onHastaChange={onHastaChange}
          onClear={onClearDates}
        />
      </div>
    </div>
  );
}
