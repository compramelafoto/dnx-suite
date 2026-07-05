"use client";

import OrderCompactRow, { COMPACT_ROW_GRID } from "./OrderCompactRow";
import OrdersBulkCheckbox from "./OrdersBulkCheckbox";
import { rowKey, type PhotographerOrderRow } from "./photographer-order-types";
import { cn } from "@/lib/utils";

type OrdersDesktopListProps = {
  orders: PhotographerOrderRow[];
  selectedOrderKey: string | null;
  bulkSelectedKeys: Set<string>;
  allVisibleSelected: boolean;
  someVisibleSelected: boolean;
  onToggleBulkKey: (key: string) => void;
  onToggleAllVisible: () => void;
  downloading: Record<string, boolean>;
  copiedLinkId: string | null;
  onSelectOrder: (key: string) => void;
  onDownload: (key: string, orderId: number, orderType: "PRINT" | "DIGITAL") => Promise<void>;
  onCopyLink: (linkKey: string, url: string) => Promise<void>;
};

export default function OrdersDesktopList({
  orders,
  selectedOrderKey,
  bulkSelectedKeys,
  allVisibleSelected,
  someVisibleSelected,
  onToggleBulkKey,
  onToggleAllVisible,
  downloading,
  copiedLinkId,
  onSelectOrder,
  onDownload,
  onCopyLink,
}: OrdersDesktopListProps) {
  if (orders.length === 0) {
    return (
      <div className="hidden md:block rounded-lg border border-gray-100 bg-white p-6 text-center text-sm text-gray-500">
        No hay pedidos con ese filtro.
      </div>
    );
  }

  return (
    <div className="hidden md:block w-full min-w-0 rounded-lg border border-gray-100 bg-white overflow-hidden">
      <div
        className={cn(
          "grid gap-x-3 px-3 py-1.5 border-b border-gray-50 bg-gray-50/50 text-[10px] font-medium uppercase tracking-wide text-gray-400 items-center",
          COMPACT_ROW_GRID
        )}
      >
        <div className="flex items-center justify-center">
          <OrdersBulkCheckbox
            checked={allVisibleSelected}
            indeterminate={someVisibleSelected && !allVisibleSelected}
            onChange={onToggleAllVisible}
            ariaLabel="Seleccionar pedidos visibles"
          />
        </div>
        <span className="sr-only">Preview</span>
        <span aria-hidden className="w-[52px]" />
        <span>Pedido</span>
        <span>Cliente</span>
        <span>Estado</span>
        <span className="text-right">Monto</span>
      </div>

      {orders.map((o) => {
        const key = rowKey(o);
        return (
          <OrderCompactRow
            key={key}
            order={o}
            selected={selectedOrderKey === key}
            bulkSelected={bulkSelectedKeys.has(key)}
            onToggleBulk={() => onToggleBulkKey(key)}
            downloading={downloading}
            copiedLinkId={copiedLinkId}
            onSelect={() => onSelectOrder(key)}
            onDownload={onDownload}
            onCopyLink={onCopyLink}
            layout="desktop"
          />
        );
      })}
    </div>
  );
}
