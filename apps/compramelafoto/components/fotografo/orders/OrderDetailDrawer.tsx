"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import CollaborativeEventSaleBreakdown from "@/components/sales/CollaborativeEventSaleBreakdown";
import OrdersTypeBadge from "./OrdersTypeBadge";
import OrdersActions from "./OrdersActions";
import OrderDrawerQuickActions from "./OrderDrawerQuickActions";
import type { OrdersQuickAutomationHandlers } from "./orders-quick-automation-helpers";
import {
  buildOrderProductLines,
  buildOrderTimeline,
  getDownloadStatusLabel,
  getOrderTypeLabel,
  getPickupLabel,
  getPrintStatusLabel,
} from "./order-detail-helpers";
import { IconClear } from "./orders-ui-primitives";
import { buildCustomerWhatsappUrl } from "./photographer-order-contact";
import {
  getPaymentStatusLabel,
  isDataProtected,
  isOrderPaid,
  type PhotographerOrderRow,
} from "./photographer-order-types";

type OrderDetailDrawerProps = {
  order: PhotographerOrderRow | null;
  open: boolean;
  onClose: () => void;
  downloading: Record<string, boolean>;
  copiedLinkId: string | null;
  updatingStatus: Record<number, boolean>;
  onDownload: (key: string, orderId: number, orderType: "PRINT" | "DIGITAL") => Promise<void>;
  onOpenDownloadCenter?: (key: string, orderId: number) => Promise<void>;
  onCopyLink: (linkKey: string, url: string) => Promise<void>;
  onCopyDigitalLink: (linkKey: string, orderId: number) => Promise<void>;
  onStatusChange: (orderId: number, newStatus: string) => void;
  automationHandlers: OrdersQuickAutomationHandlers;
};

export default function OrderDetailDrawer({
  order,
  open,
  onClose,
  downloading,
  copiedLinkId,
  updatingStatus,
  onDownload,
  onOpenDownloadCenter,
  onCopyLink,
  onCopyDigitalLink,
  onStatusChange,
  automationHandlers,
}: OrderDetailDrawerProps) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => setVisible(true));
      document.body.style.overflow = "hidden";
    } else {
      setVisible(false);
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted || !open || !order) return null;

  const protectedData = isDataProtected(order);
  const paid = isOrderPaid(order);
  const whatsappUrl = !protectedData
    ? buildCustomerWhatsappUrl(order.customerPhone, order.customerName, order.photographerInstagram)
    : null;
  const products = buildOrderProductLines(order);
  const timeline = buildOrderTimeline(order);
  const hasEventSale = Boolean(order.eventOrganizerSale?.active);
  const printStatus = getPrintStatusLabel(order);

  return createPortal(
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-labelledby="order-drawer-title">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-black/40 transition-opacity duration-200",
          visible ? "opacity-100" : "opacity-0"
        )}
      />
      <aside
        className={cn(
          "absolute top-0 right-0 flex h-full w-full flex-col bg-white shadow-2xl",
          "md:max-w-[520px] transition-transform duration-200 ease-out",
          visible ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3">
          <div className="min-w-0">
            <h2 id="order-drawer-title" className="text-base font-bold text-gray-900 leading-none">
              Pedido #{order.id}
            </h2>
            <p className="mt-1 text-xs text-gray-500">{order.createdAtText}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar detalle"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
          >
            <IconClear />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <div className="ds-stack-section gap-5 p-4">
            {/* Bloque 1 — Resumen */}
            <section className="ds-stack-section gap-2">
              <SectionTitle>Resumen</SectionTitle>
              <div className="ds-card rounded-xl border border-gray-200 p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <OrdersTypeBadge order={order} />
                  <span className="text-xs text-gray-600">{getOrderTypeLabel(order)}</span>
                </div>
                <SummaryRow label="Estado pago" value={getPaymentStatusLabel(order)} />
                <SummaryRow label="Descarga" value={getDownloadStatusLabel(order)} />
                {printStatus ? <SummaryRow label="Impresión" value={printStatus} /> : null}
                {order.labName && order.labName !== "-" ? (
                  <SummaryRow label="Laboratorio" value={order.labName} />
                ) : null}
                {order.pickupBy ? (
                  <SummaryRow label="Retiro" value={getPickupLabel(order.pickupBy)} />
                ) : null}
                <SummaryRow
                  label="Monto"
                  value={`${order.currency} ${order.total.toLocaleString("es-AR")}`}
                  strong
                />
              </div>
            </section>

            {/* Bloque 2 — Cliente */}
            <section className="ds-stack-section gap-2">
              <SectionTitle>Cliente</SectionTitle>
              <div className="ds-card rounded-xl border border-gray-200 p-3 space-y-1.5">
                {protectedData ? (
                  <>
                    <p className="text-sm font-semibold text-amber-900">🔒 Datos protegidos</p>
                    <p className="text-xs text-gray-500">Visibles cuando el pago esté acreditado.</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-gray-900">{order.customerName || "Sin nombre"}</p>
                    {order.customerEmail ? (
                      <p className="text-xs text-gray-600">{order.customerEmail}</p>
                    ) : null}
                    {order.customerPhone ? (
                      <p className="text-xs text-gray-500">{order.customerPhone}</p>
                    ) : null}
                    {whatsappUrl ? (
                      <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex mt-1 text-xs font-medium text-[#128C7E] hover:underline"
                      >
                        Abrir WhatsApp →
                      </a>
                    ) : null}
                  </>
                )}
              </div>
            </section>

            {/* Bloque 3 — Productos */}
            <section className="ds-stack-section gap-2">
              <SectionTitle>Productos</SectionTitle>
              <div className="ds-card rounded-xl border border-gray-200 divide-y divide-gray-100">
                {products.map((line) => (
                  <div key={line.label} className="flex items-center justify-between gap-2 px-3 py-2.5 min-w-0">
                    <p className="text-sm text-gray-900 truncate">{line.label}</p>
                    {line.detail ? (
                      <p className="text-xs text-gray-500 shrink-0">{line.detail}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>

            {/* Bloque 4 — Archivos */}
            {paid ? (
              <section className="ds-stack-section gap-2">
                <SectionTitle>Archivos</SectionTitle>
                <div className="ds-card rounded-xl border border-gray-200 p-3 text-xs text-gray-600">
                  Descargá carpetas ZIP, exportaciones de impresión y links desde acciones abajo.
                </div>
              </section>
            ) : null}

            {/* Bloque 5 — Timeline */}
            <section className="ds-stack-section gap-2">
              <SectionTitle>Timeline</SectionTitle>
              <div className="ds-card rounded-xl border border-gray-200 p-3">
                <ol className="relative space-y-0">
                  {timeline.map((ev, i) => (
                    <li key={`${ev.label}-${i}`} className="flex gap-3 pb-4 last:pb-0">
                      <div className="flex flex-col items-center">
                        <span
                          className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm",
                            ev.done ? "bg-emerald-50 ring-1 ring-emerald-200" : "bg-gray-100 ring-1 ring-gray-200"
                          )}
                          aria-hidden
                        >
                          {ev.icon}
                        </span>
                        {i < timeline.length - 1 ? (
                          <span className="mt-1 w-px flex-1 min-h-[12px] bg-gray-200" />
                        ) : null}
                      </div>
                      <div className="min-w-0 pt-0.5">
                        <p className={cn("text-sm font-medium", ev.done ? "text-gray-900" : "text-gray-500")}>
                          {ev.label}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{ev.time}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </section>

            {hasEventSale && order.eventOrganizerSale ? (
              <section className="ds-stack-section gap-2">
                <SectionTitle>Comisión organizador</SectionTitle>
                <div className="rounded-xl bg-purple-50/80 p-3 ring-1 ring-purple-100">
                  <CollaborativeEventSaleBreakdown
                    breakdown={order.eventOrganizerSale}
                    variant="compact"
                    audience="photographer"
                  />
                </div>
              </section>
            ) : null}

            {/* Bloque 6 — Acciones rápidas */}
            <OrderDrawerQuickActions order={order} handlers={automationHandlers} />

            {/* Bloque 7 — Acciones completas */}
            <section className="ds-stack-section gap-2 pb-2">
              <SectionTitle>Acciones</SectionTitle>
              <div className="ds-action-bar ds-card rounded-xl border border-gray-200 p-3">
                <OrdersActions
                  order={order}
                  downloading={downloading}
                  copiedLinkId={copiedLinkId}
                  updatingStatus={updatingStatus}
                  onDownload={onDownload}
                  onOpenDownloadCenter={onOpenDownloadCenter}
                  onCopyLink={onCopyLink}
                  onCopyDigitalLink={onCopyDigitalLink}
                  onStatusChange={onStatusChange}
                  layout="drawer"
                />
              </div>
            </section>
          </div>
        </div>
      </aside>
    </div>,
    document.body
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 leading-none">
      {children}
    </h3>
  );
}

function SummaryRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-xs">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className={cn("text-right truncate", strong ? "font-bold text-gray-900" : "text-gray-800")}>
        {value}
      </span>
    </div>
  );
}
