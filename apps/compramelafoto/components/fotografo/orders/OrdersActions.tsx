"use client";

import { cn } from "@/lib/utils";
import {
  IconCheck,
  IconCopy,
  IconDownload,
  IconWhatsApp,
  OrdersIconButton,
  OrdersPrimaryButton,
} from "./orders-ui-primitives";
import { buildCustomerWhatsappUrl } from "./photographer-order-contact";
import {
  ALLOWED_STATUSES,
  STATUS_LABEL,
  getOrderFulfillmentKind,
  isDataProtected,
  isOrderPaid,
  type PhotographerOrderRow,
} from "./photographer-order-types";

type OrdersActionsProps = {
  order: PhotographerOrderRow;
  downloading: Record<string, boolean>;
  copiedLinkId: string | null;
  updatingStatus: Record<number, boolean>;
  onDownload: (key: string, orderId: number, orderType: "PRINT" | "DIGITAL") => Promise<void>;
  onOpenDownloadCenter?: (key: string, orderId: number) => Promise<void>;
  onCopyLink: (linkKey: string, url: string) => Promise<void>;
  onCopyDigitalLink?: (linkKey: string, orderId: number) => Promise<void>;
  onStatusChange: (orderId: number, newStatus: string) => void;
  layout?: "desktop" | "mobile" | "drawer";
};

export default function OrdersActions({
  order,
  downloading,
  copiedLinkId,
  updatingStatus,
  onDownload,
  onOpenDownloadCenter,
  onCopyLink,
  onCopyDigitalLink,
  onStatusChange,
  layout = "desktop",
}: OrdersActionsProps) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const whatsappUrl = !isDataProtected(order)
    ? buildCustomerWhatsappUrl(order.customerPhone, order.customerName, order.photographerInstagram)
    : null;
  const paid = isOrderPaid(order);
  const isDrawer = layout === "drawer";

  if (!paid && !isDrawer) {
    return layout === "desktop" ? (
      <span className="text-[10px] text-gray-300 leading-none">—</span>
    ) : null;
  }

  if (!paid && isDrawer) {
    return (
      <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
        Las descargas se habilitan cuando el pago esté acreditado.
      </p>
    );
  }

  return (
    <div className={cn("min-w-0", isDrawer && "space-y-3")}>
      <OrdersDownloadActions
        order={order}
        origin={origin}
        downloading={downloading}
        copiedLinkId={copiedLinkId}
        whatsappUrl={whatsappUrl}
        onDownload={onDownload}
        onOpenDownloadCenter={onOpenDownloadCenter}
        onCopyLink={onCopyLink}
        onCopyDigitalLink={onCopyDigitalLink}
        layout={layout}
      />
      <OrdersDeliveryActions
        order={order}
        updatingStatus={updatingStatus}
        onStatusChange={onStatusChange}
        layout={layout}
      />
    </div>
  );
}

function OrdersDownloadActions({
  order,
  origin,
  downloading,
  copiedLinkId,
  whatsappUrl,
  onDownload,
  onOpenDownloadCenter,
  onCopyLink,
  onCopyDigitalLink,
  layout,
}: {
  order: PhotographerOrderRow;
  origin: string;
  downloading: Record<string, boolean>;
  copiedLinkId: string | null;
  whatsappUrl: string | null;
  onDownload: (key: string, orderId: number, orderType: "PRINT" | "DIGITAL") => Promise<void>;
  onOpenDownloadCenter?: (key: string, orderId: number) => Promise<void>;
  onCopyLink: (linkKey: string, url: string) => Promise<void>;
  onCopyDigitalLink?: (linkKey: string, orderId: number) => Promise<void>;
  layout: "desktop" | "mobile" | "drawer";
}) {
  const isDrawer = layout === "drawer";
  const isMobile = layout === "mobile";

  const fk = getOrderFulfillmentKind(order);
  const hasD =
    order.source === "ALBUM_ORDER" &&
    (order.hasDigitalItems ?? (fk === "DIGITAL" || fk === "MIXED"));
  const hasP =
    order.source === "PRINT_ORDER" ||
    (order.hasPrintItems ?? (fk === "PRINT" || fk === "MIXED"));

  const printLinkKey = order.source === "PRINT_ORDER" ? `p-${order.id}` : `e-${order.id}`;
  const printExportUrl =
    order.source === "PRINT_ORDER"
      ? `${origin}/api/print-orders/${order.id}/export`
      : `${origin}/api/fotografo/pedidos/${order.id}/export-print`;
  const printCopied = copiedLinkId === printLinkKey;

  const digKey = `d-${order.id}`;
  const digCenterKey = `dc-${order.id}`;
  const digCopyKey = `cd-${order.id}`;
  const digCopied = copiedLinkId === digCopyKey;
  const digitalCount = order.digitalItemsCount ?? 0;
  const multipleDigitals = digitalCount > 1;

  if (isDrawer || isMobile) {
    return (
      <DrawerActionStack whatsappUrl={whatsappUrl}>
        {hasP ? (
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Impresiones</p>
            <OrdersPrimaryButton
              icon={<IconDownload />}
              loading={downloading[printLinkKey]}
              className="w-full"
              onClick={() => {
                if (order.source === "PRINT_ORDER") {
                  void onDownload(printLinkKey, order.id, "PRINT");
                } else {
                  window.open(printExportUrl, "_blank");
                }
              }}
            >
              Descargar impresiones
            </OrdersPrimaryButton>
            <DrawerOutlineButton
              icon={printCopied ? <IconCheck /> : <IconCopy />}
              label={printCopied ? "Link copiado" : "Copiar link impresiones"}
              onClick={() => onCopyLink(printLinkKey, printExportUrl)}
            />
          </div>
        ) : null}

        {hasD ? (
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Digitales</p>
            {multipleDigitals ? (
              <>
                <OrdersPrimaryButton
                  icon={<IconDownload />}
                  loading={downloading[digKey]}
                  className="w-full"
                  onClick={() => onDownload(digKey, order.id, "DIGITAL")}
                >
                  Descargar ZIP
                </OrdersPrimaryButton>
                {onOpenDownloadCenter ? (
                  <DrawerOutlineButton
                    icon={<IconDownload />}
                    label="Centro de descargas"
                    loading={downloading[digCenterKey]}
                    onClick={() => onOpenDownloadCenter(digCenterKey, order.id)}
                  />
                ) : null}
              </>
            ) : (
              <OrdersPrimaryButton
                icon={<IconDownload />}
                loading={downloading[digKey]}
                className="w-full"
                onClick={() => onDownload(digKey, order.id, "DIGITAL")}
              >
                Descargar digitales
              </OrdersPrimaryButton>
            )}
            <DrawerOutlineButton
              icon={digCopied ? <IconCheck /> : <IconCopy />}
              label={digCopied ? "Link copiado" : "Copiar link digitales"}
              loading={downloading[digCopyKey]}
              onClick={() => onCopyDigitalLink?.(digCopyKey, order.id)}
            />
          </div>
        ) : null}
      </DrawerActionStack>
    );
  }

  if (order.source === "PRINT_ORDER") {
    return (
      <IconActionRow>
        <OrdersIconButton
          label="Descargar impresiones"
          variant="primary"
          disabled={downloading[printLinkKey]}
          onClick={() => onDownload(printLinkKey, order.id, "PRINT")}
        >
          {downloading[printLinkKey] ? <span className="text-xs">…</span> : <IconDownload />}
        </OrdersIconButton>
        <OrdersIconButton
          label={printCopied ? "Copiado" : "Copiar link impresiones"}
          variant={printCopied ? "copied" : "default"}
          onClick={() => onCopyLink(printLinkKey, printExportUrl)}
        >
          {printCopied ? <IconCheck /> : <IconCopy />}
        </OrdersIconButton>
        {whatsappUrl ? <WhatsAppLink url={whatsappUrl} /> : null}
      </IconActionRow>
    );
  }

  const printCopiedAlbum = copiedLinkId === printLinkKey;

  return (
    <IconActionRow>
      {hasD ? (
        <OrdersIconButton
          label={multipleDigitals ? "Descargar ZIP" : "Descargar digital"}
          variant="primary"
          disabled={downloading[digKey]}
          onClick={() => onDownload(digKey, order.id, "DIGITAL")}
        >
          {downloading[digKey] ? <span className="text-xs">…</span> : <IconDownload />}
        </OrdersIconButton>
      ) : null}
      {hasP ? (
        <OrdersIconButton
          label="Descargar impresiones"
          variant={hasD ? "success" : "primary"}
          onClick={() => window.open(printExportUrl, "_blank")}
        >
          <IconDownload />
        </OrdersIconButton>
      ) : null}
      {hasP ? (
        <OrdersIconButton
          label={printCopiedAlbum ? "Copiado" : "Copiar link impresiones"}
          variant={printCopiedAlbum ? "copied" : "default"}
          onClick={() => onCopyLink(printLinkKey, printExportUrl)}
        >
          {printCopiedAlbum ? <IconCheck /> : <IconCopy />}
        </OrdersIconButton>
      ) : null}
      {whatsappUrl ? <WhatsAppLink url={whatsappUrl} /> : null}
    </IconActionRow>
  );
}

function DrawerOutlineButton({
  icon,
  label,
  onClick,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={loading}
      onClick={onClick}
      className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50"
    >
      {icon}
      {label}
    </button>
  );
}

function DrawerActionStack({
  children,
  whatsappUrl,
}: {
  children: React.ReactNode;
  whatsappUrl: string | null;
}) {
  return (
    <div className="space-y-2">
      {children}
      {whatsappUrl ? (
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#128C7E]/30 bg-[#25D366] px-3 py-2.5 text-sm font-semibold text-white hover:bg-[#1fb855] transition-colors"
        >
          <IconWhatsApp />
          WhatsApp con cliente
        </a>
      ) : null}
    </div>
  );
}

function IconActionRow({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-end gap-1 flex-nowrap">{children}</div>;
}

function WhatsAppLink({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title="WhatsApp"
      aria-label="WhatsApp"
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#128C7E]/30 bg-[#25D366] text-white hover:bg-[#1fb855] transition-colors"
    >
      <IconWhatsApp />
    </a>
  );
}

function OrdersDeliveryActions({
  order,
  updatingStatus,
  onStatusChange,
  layout,
}: {
  order: PhotographerOrderRow;
  updatingStatus: Record<number, boolean>;
  onStatusChange: (orderId: number, newStatus: string) => void;
  layout: "desktop" | "mobile" | "drawer";
}) {
  if (order.source !== "PRINT_ORDER" || order.pickupBy !== "PHOTOGRAPHER") {
    return null;
  }

  const isDrawer = layout === "drawer";

  return (
    <div className={isDrawer ? "space-y-1.5" : ""}>
      {isDrawer ? (
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Estado de entrega</p>
      ) : null}
      <select
        value={order.status}
        onChange={(e) => onStatusChange(order.id, e.target.value)}
        disabled={updatingStatus[order.id]}
        title="Actualizar estado del pedido"
        aria-label="Estado del pedido"
        className={cn(
          "rounded-lg border border-[#c27b3d]/35 bg-white px-2 py-2 text-xs font-medium text-gray-800 cursor-pointer disabled:opacity-60",
          isDrawer || layout === "mobile" ? "w-full" : "w-[140px] mt-1.5"
        )}
      >
        {ALLOWED_STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABEL[s] || s}
          </option>
        ))}
      </select>
    </div>
  );
}
