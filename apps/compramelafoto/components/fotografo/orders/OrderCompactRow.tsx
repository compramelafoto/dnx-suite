"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";
import OrdersBulkCheckbox from "./OrdersBulkCheckbox";
import OrdersTypeBadge from "./OrdersTypeBadge";
import OrdersStatusBadges from "./OrdersStatusBadges";
import OrdersAmountColumn from "./OrdersAmountColumn";
import OrdersQuickActions from "./OrdersQuickActions";
import OrderVisualThumbnail from "./OrderVisualThumbnail";
import OrderQuickPreview from "./OrderQuickPreview";
import { useOrderVisual } from "./useOrderVisual";
import { isDataProtected, type PhotographerOrderRow } from "./photographer-order-types";

/** Desktop: checkbox | thumb | Pedido | Cliente | Estado | Monto */
export const COMPACT_ROW_GRID =
  "grid-cols-[28px_52px_minmax(92px,108px)_minmax(150px,1.2fr)_minmax(160px,1fr)_minmax(130px,auto)]";

type OrderCompactRowProps = {
  order: PhotographerOrderRow;
  selected?: boolean;
  bulkSelected?: boolean;
  showBulkCheckbox?: boolean;
  onToggleBulk?: () => void;
  downloading: Record<string, boolean>;
  copiedLinkId: string | null;
  onSelect: () => void;
  onDownload: (key: string, orderId: number, orderType: "PRINT" | "DIGITAL") => Promise<void>;
  onCopyLink: (linkKey: string, url: string) => Promise<void>;
  layout: "desktop" | "mobile";
  mobileSelectionMode?: boolean;
};

export default function OrderCompactRow({
  order,
  selected,
  bulkSelected = false,
  showBulkCheckbox = false,
  onToggleBulk,
  downloading,
  copiedLinkId,
  onSelect,
  onDownload,
  onCopyLink,
  layout,
  mobileSelectionMode = false,
}: OrderCompactRowProps) {
  const previewAnchorRef = useRef<HTMLDivElement>(null);
  const { containerRef: visualRef, visual } = useOrderVisual(order);

  const hasEventSale = Boolean(order.eventOrganizerSale?.active);
  const received =
    order.photographerReceivedAmount ??
    (hasEventSale ? order.eventOrganizerSale!.photographerNetAmount : order.total);
  const protectedData = isDataProtected(order);

  const quickActions = (
    <OrdersQuickActions
      order={order}
      downloading={downloading}
      copiedLinkId={copiedLinkId}
      onDownload={onDownload}
      onCopyLink={onCopyLink}
    />
  );

  if (layout === "mobile") {
    const handleMobileClick = () => {
      if (mobileSelectionMode && onToggleBulk) {
        onToggleBulk();
        return;
      }
      onSelect();
    };

    return (
      <div
        role="button"
        tabIndex={0}
        onClick={handleMobileClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleMobileClick();
          }
        }}
        className={cn(
          "w-full text-left rounded-lg border bg-white px-2.5 py-2 transition-colors cursor-pointer",
          bulkSelected
            ? "border-sky-300/60 bg-sky-50/80 border-l-2 border-l-sky-500"
            : selected
              ? "border-[#c27b3d]/40 bg-[#c27b3d]/[0.03]"
              : "border-gray-100 hover:border-gray-200 hover:bg-gray-50/60"
        )}
      >
        <div className="flex gap-2.5 min-w-0">
          {showBulkCheckbox ? (
            <div className="pt-1 shrink-0" onClick={(e) => e.stopPropagation()}>
              <OrdersBulkCheckbox
                checked={bulkSelected}
                onChange={() => onToggleBulk?.()}
                ariaLabel={`Seleccionar pedido #${order.id}`}
              />
            </div>
          ) : null}
          <div ref={visualRef} className="pt-0.5 shrink-0">
            <OrderVisualThumbnail order={order} visual={visual} size="sm" />
          </div>
          <div className="space-y-1.5 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-sm font-bold text-gray-900 leading-none">#{order.id}</span>
              <OrdersTypeBadge order={order} />
              <span className="text-[10px] text-gray-400 leading-none">{order.createdAtText}</span>
            </div>
            <OrdersStatusBadges order={order} />
            <CompactCustomer order={order} protectedData={protectedData} />
            <div className="flex items-end justify-between gap-3 pt-0.5">
              <OrdersAmountColumn
                order={order}
                hasEventSale={hasEventSale}
                received={received}
                align="left"
              />
              {quickActions}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "group grid gap-x-3 items-center px-3 py-1.5 border-b border-gray-50 cursor-pointer transition-colors",
        COMPACT_ROW_GRID,
        bulkSelected
          ? "bg-sky-50/80 border-l-2 border-l-sky-500"
          : selected
            ? "bg-[#c27b3d]/[0.03] border-l-2 border-l-[#c27b3d]"
            : "hover:bg-gray-50/60 border-l-2 border-l-transparent"
      )}
    >
      <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
        <OrdersBulkCheckbox
          checked={bulkSelected}
          onChange={() => onToggleBulk?.()}
          ariaLabel={`Seleccionar pedido #${order.id}`}
        />
      </div>

      <div ref={visualRef} className="flex items-center justify-center">
        <OrderVisualThumbnail order={order} visual={visual} size="md" />
      </div>

      <div ref={previewAnchorRef} className="min-w-0">
        <div className="flex items-center gap-1 min-w-0">
          <span className="text-xs font-bold text-gray-900 leading-none shrink-0">#{order.id}</span>
          <OrdersTypeBadge order={order} />
          <OrderQuickPreview order={order} visual={visual} anchorRef={previewAnchorRef} />
        </div>
        <p className="mt-0.5 text-[10px] text-gray-500 leading-none truncate">{order.createdAtText}</p>
      </div>

      <CompactCustomer order={order} protectedData={protectedData} />

      <div className="min-w-0">
        <OrdersStatusBadges order={order} />
      </div>

      <div className="min-w-0 flex flex-col items-end gap-1">
        <OrdersAmountColumn order={order} hasEventSale={hasEventSale} received={received} />
        {quickActions}
      </div>
    </div>
  );
}

function CompactCustomer({
  order,
  protectedData,
}: {
  order: PhotographerOrderRow;
  protectedData: boolean;
}) {
  if (protectedData) {
    return (
      <p className="text-[11px] font-medium text-amber-800 leading-none">🔒 Protegido</p>
    );
  }

  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-gray-900 truncate leading-tight">
        {order.customerName || "Sin nombre"}
      </p>
      {order.customerEmail ? (
        <p className="text-[10px] text-gray-500 truncate leading-none mt-0.5">{order.customerEmail}</p>
      ) : null}
    </div>
  );
}
