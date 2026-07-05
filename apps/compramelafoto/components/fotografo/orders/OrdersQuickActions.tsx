"use client";

import {
  IconCheck,
  IconCopy,
  IconDownload,
  IconWhatsApp,
  OrdersIconButton,
} from "./orders-ui-primitives";
import { buildCustomerWhatsappUrl } from "./photographer-order-contact";
import {
  getOrderFulfillmentKind,
  isDataProtected,
  isOrderPaid,
  type PhotographerOrderRow,
} from "./photographer-order-types";

type OrdersQuickActionsProps = {
  order: PhotographerOrderRow;
  downloading: Record<string, boolean>;
  copiedLinkId: string | null;
  onDownload: (key: string, orderId: number, orderType: "PRINT" | "DIGITAL") => Promise<void>;
  onCopyLink: (linkKey: string, url: string) => Promise<void>;
};

function stop(e: React.MouseEvent) {
  e.stopPropagation();
}

export default function OrdersQuickActions({
  order,
  downloading,
  copiedLinkId,
  onDownload,
  onCopyLink,
}: OrdersQuickActionsProps) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const paid = isOrderPaid(order);
  const whatsappUrl = !isDataProtected(order)
    ? buildCustomerWhatsappUrl(order.customerPhone, order.customerName, order.photographerInstagram)
    : null;

  if (!paid && !whatsappUrl) return null;

  return (
    <div className="flex items-center justify-end gap-0.5 flex-nowrap shrink-0" onClick={stop}>
      {paid ? (
        <DownloadIcons
          order={order}
          origin={origin}
          downloading={downloading}
          copiedLinkId={copiedLinkId}
          onDownload={onDownload}
          onCopyLink={onCopyLink}
        />
      ) : null}
      {whatsappUrl ? (
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="WhatsApp"
          aria-label="WhatsApp"
          onClick={stop}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[#128C7E]/30 bg-[#25D366] text-white hover:bg-[#1fb855] transition-colors"
        >
          <IconWhatsApp className="!w-3.5 !h-3.5" />
        </a>
      ) : null}
    </div>
  );
}

function DownloadIcons({
  order,
  origin,
  downloading,
  copiedLinkId,
  onDownload,
  onCopyLink,
}: {
  order: PhotographerOrderRow;
  origin: string;
  downloading: Record<string, boolean>;
  copiedLinkId: string | null;
  onDownload: (key: string, orderId: number, orderType: "PRINT" | "DIGITAL") => Promise<void>;
  onCopyLink: (linkKey: string, url: string) => Promise<void>;
}) {
  if (order.source === "PRINT_ORDER") {
    const linkKey = `p-${order.id}`;
    const exportUrl = `${origin}/api/print-orders/${order.id}/export`;
    const copied = copiedLinkId === linkKey;
    return (
      <>
        <OrdersIconButton
          label="Descargar carpeta"
          variant="primary"
          size="sm"
          className="!h-7 !w-7"
          disabled={downloading[linkKey]}
          onClick={() => onDownload(linkKey, order.id, "PRINT")}
        >
          {downloading[linkKey] ? <span className="text-[10px]">…</span> : <IconDownload className="!w-3.5 !h-3.5" />}
        </OrdersIconButton>
        <OrdersIconButton
          label={copied ? "Copiado" : "Copiar link"}
          variant={copied ? "copied" : "default"}
          size="sm"
          className="!h-7 !w-7"
          onClick={() => onCopyLink(linkKey, exportUrl)}
        >
          {copied ? <IconCheck className="!w-3.5 !h-3.5" /> : <IconCopy className="!w-3.5 !h-3.5" />}
        </OrdersIconButton>
      </>
    );
  }

  const fk = getOrderFulfillmentKind(order);
  const hasD = order.hasDigitalItems ?? (fk === "DIGITAL" || fk === "MIXED");
  const hasP = order.hasPrintItems ?? (fk === "PRINT" || fk === "MIXED");
  const digKey = `d-${order.id}`;
  const printKey = `e-${order.id}`;
  const printUrl = `${origin}/api/fotografo/pedidos/${order.id}/export-print`;
  const printCopied = copiedLinkId === printKey;

  return (
    <>
      {hasD ? (
        <OrdersIconButton
          label="Descargar digital"
          variant="primary"
          size="sm"
          className="!h-7 !w-7"
          disabled={downloading[digKey]}
          onClick={() => onDownload(digKey, order.id, "DIGITAL")}
        >
          {downloading[digKey] ? <span className="text-[10px]">…</span> : <IconDownload className="!w-3.5 !h-3.5" />}
        </OrdersIconButton>
      ) : null}
      {hasP ? (
        <OrdersIconButton
          label="Descargar impresiones"
          variant={hasD ? "success" : "primary"}
          size="sm"
          className="!h-7 !w-7"
          onClick={() => window.open(printUrl, "_blank")}
        >
          <IconDownload className="!w-3.5 !h-3.5" />
        </OrdersIconButton>
      ) : null}
      {hasP ? (
        <OrdersIconButton
          label={printCopied ? "Copiado" : "Copiar link impresiones"}
          variant={printCopied ? "copied" : "default"}
          size="sm"
          className="!h-7 !w-7"
          onClick={() => onCopyLink(printKey, printUrl)}
        >
          {printCopied ? <IconCheck className="!w-3.5 !h-3.5" /> : <IconCopy className="!w-3.5 !h-3.5" />}
        </OrdersIconButton>
      ) : null}
    </>
  );
}
