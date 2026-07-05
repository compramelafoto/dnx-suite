"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { IconEye } from "./orders-ui-primitives";
import OrdersTypeBadge from "./OrdersTypeBadge";
import OrdersStatusBadges from "./OrdersStatusBadges";
import OrdersAmountColumn from "./OrdersAmountColumn";
import { buildOrderProductLines, getOrderTypeLabel } from "./order-detail-helpers";
import {
  getOrderVisualInitials,
  PLACEHOLDER_GRADIENTS,
  type OrderVisualData,
} from "./order-visual-types";
import { isDataProtected, type PhotographerOrderRow } from "./photographer-order-types";

const HOVER_DELAY_MS = 260;

type OrderQuickPreviewProps = {
  order: PhotographerOrderRow;
  visual: OrderVisualData;
  anchorRef: React.RefObject<HTMLElement | null>;
};

export default function OrderQuickPreview({ order, visual, anchorRef }: OrderQuickPreviewProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const timerRef = useRef<number | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const protectedData = isDataProtected(order);
  const hasEventSale = Boolean(order.eventOrganizerSale?.active);
  const received =
    order.photographerReceivedAmount ??
    (hasEventSale ? order.eventOrganizerSale!.photographerNetAmount : order.total);

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const cardWidth = 320;
    const margin = 12;
    let left = rect.right + margin;
    if (left + cardWidth > window.innerWidth - margin) {
      left = rect.left - cardWidth - margin;
    }
    left = Math.max(margin, Math.min(left, window.innerWidth - cardWidth - margin));
    const top = Math.max(margin, Math.min(rect.top, window.innerHeight - 280));
    setPosition({ top, left });
  }, [anchorRef]);

  const scheduleOpen = () => {
    if (typeof window !== "undefined" && !window.matchMedia("(min-width: 768px)").matches) {
      return;
    }
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      updatePosition();
      setOpen(true);
    }, HOVER_DELAY_MS);
  };

  const scheduleClose = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setOpen(false), 120);
  };

  const cancelClose = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
  };

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const onScroll = () => updatePosition();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  const gallery = visual.galleryUrls.slice(0, 6);
  const productLines = buildOrderProductLines(order);

  return (
    <>
      <button
        type="button"
        aria-label="Vista rápida del pedido"
        title="Vista rápida"
        onMouseEnter={scheduleOpen}
        onMouseLeave={scheduleClose}
        onFocus={scheduleOpen}
        onBlur={scheduleClose}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "hidden md:inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
          "border border-gray-200 bg-white/90 text-gray-500 opacity-0 transition-all",
          "group-hover:opacity-100 hover:border-gray-300 hover:text-gray-800 hover:bg-white"
        )}
      >
        <IconEye className="!w-3.5 !h-3.5" />
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={cardRef}
              role="tooltip"
              onMouseEnter={cancelClose}
              onMouseLeave={scheduleClose}
              className="hidden md:block fixed z-50 w-80 rounded-2xl border border-gray-200/90 bg-white/95 p-3 shadow-2xl backdrop-blur-md"
              style={{ top: position.top, left: position.left }}
            >
              <div className="flex items-start justify-between gap-2 mb-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900 leading-none">Pedido #{order.id}</p>
                  <p className="mt-1 text-[11px] text-gray-500">{getOrderTypeLabel(order)} · {order.createdAtText}</p>
                </div>
                <OrdersTypeBadge order={order} />
              </div>

              {gallery.length > 0 ? (
                <div className="grid grid-cols-3 gap-1.5 mb-2.5">
                  {gallery.map((url, idx) => (
                    <div
                      key={`${url}-${idx}`}
                      className="relative aspect-square overflow-hidden rounded-lg border border-gray-100 bg-gray-50"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  className={cn(
                    "mb-2.5 flex h-20 items-center justify-center rounded-xl border border-gray-100 bg-gradient-to-br",
                    PLACEHOLDER_GRADIENTS[visual.placeholder]
                  )}
                >
                  <span className="text-xs font-semibold text-white/90 drop-shadow">
                    {getOrderVisualInitials(order)} · {order.itemsCount} ítem{order.itemsCount === 1 ? "" : "s"}
                  </span>
                </div>
              )}

              <div className="space-y-2">
                <OrdersStatusBadges order={order} />
                <div className="rounded-lg bg-gray-50 px-2.5 py-2 text-[11px] text-gray-600 space-y-1">
                  {protectedData ? (
                    <p>Cliente protegido hasta acreditación del pago.</p>
                  ) : (
                    <>
                      <p className="font-medium text-gray-800 truncate">
                        {order.customerName || "Sin nombre"}
                      </p>
                      {order.customerEmail ? (
                        <p className="truncate text-gray-500">{order.customerEmail}</p>
                      ) : null}
                    </>
                  )}
                  {productLines.map((line) => (
                    <p key={line.label}>
                      {line.label}
                      {line.detail ? ` · ${line.detail}` : ""}
                    </p>
                  ))}
                </div>
                <div className="flex items-end justify-between gap-2 pt-0.5">
                  <OrdersAmountColumn
                    order={order}
                    hasEventSale={hasEventSale}
                    received={received}
                    align="left"
                  />
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
