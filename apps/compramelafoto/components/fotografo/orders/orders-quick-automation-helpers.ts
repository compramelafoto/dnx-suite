import type { OrderActivityEvent, OrdersAttentionItem } from "./orders-activity-helpers";
import type { OperationalInsight, OperationalRecommendation } from "./orders-intelligence-helpers";
import { buildCustomerWhatsappUrl } from "./photographer-order-contact";
import {
  getOrderFulfillmentKind,
  isDataProtected,
  isDownloadAvailable,
  isOrderPaid,
  isOrderPending,
  type OrdersQuickFilter,
  type PhotographerOrderRow,
} from "./photographer-order-types";

export type QuickChipAction = {
  id: string;
  label: string;
  variant?: "default" | "primary" | "whatsapp" | "success" | "muted";
  href?: string;
  disabled?: boolean;
  run?: () => void;
};

export type OrdersQuickAutomationHandlers = {
  onFilter: (filter: OrdersQuickFilter) => void;
  onSelectOrder: (orderKey: string) => void;
  onExportOrder: (order: PhotographerOrderRow) => void;
  onMarkDelivered: (orderId: number) => void;
  onDownloadOrder: (order: PhotographerOrderRow, type: "PRINT" | "DIGITAL") => void;
  onCopyDigitalLink: (order: PhotographerOrderRow) => void;
};

export function buildDownloadReminderMailto(order: PhotographerOrderRow): string | null {
  if (isDataProtected(order)) return null;
  const email = order.customerEmail?.trim();
  if (!email || email.includes("Protegido")) return null;
  const subject = encodeURIComponent("Tus fotos están listas para descargar");
  const name = order.customerName && !order.customerName.includes("Protegido") ? order.customerName : "";
  const body = encodeURIComponent(
    `Hola${name ? ` ${name}` : ""},\n\nTe escribo para recordarte que tus fotos del pedido #${order.id} ya están disponibles para descargar.\n\n¡Saludos!`
  );
  return `mailto:${email}?subject=${subject}&body=${body}`;
}

export function buildPendingReminderMailto(order: PhotographerOrderRow): string | null {
  if (isDataProtected(order)) return null;
  const email = order.customerEmail?.trim();
  if (!email || email.includes("Protegido")) return null;
  const subject = encodeURIComponent(`Pedido #${order.id} — completar pago`);
  const body = encodeURIComponent(
    `Hola,\n\nTe contacto respecto a tu pedido #${order.id} que quedó pendiente de pago. Si necesitás ayuda para completarlo, escribime.\n\n¡Gracias!`
  );
  return `mailto:${email}?subject=${subject}&body=${body}`;
}

export function getInsightQuickActions(
  insight: OperationalInsight,
  handlers: OrdersQuickAutomationHandlers
): QuickChipAction[] {
  const map: Record<string, QuickChipAction[]> = {
    "stale-pending": [
      { id: "filter-pending", label: "Ver pendientes", variant: "primary", run: () => handlers.onFilter("PENDING") },
    ],
    "awaiting-download": [
      {
        id: "remind-downloads",
        label: "Recordar descargas",
        variant: "primary",
        run: () => handlers.onFilter("DIGITAL"),
      },
    ],
    "print-ready": [
      { id: "filter-print", label: "Exportar listas", variant: "primary", run: () => handlers.onFilter("PRINT") },
    ],
    "print-pending": [
      { id: "manage-print", label: "Gestionar entregas", run: () => handlers.onFilter("PRINT") },
    ],
    "video-growth": [
      { id: "filter-video", label: "Ver videos", run: () => handlers.onFilter("VIDEO") },
    ],
    "digital-dominant": [
      { id: "filter-digital", label: "Ver digitales", run: () => handlers.onFilter("DIGITAL") },
    ],
    protected: [
      { id: "filter-protected", label: "Ver protegidos", variant: "muted", run: () => handlers.onFilter("PENDING") },
    ],
    "recent-activity": [
      { id: "filter-paid", label: "Ver pagados", variant: "success", run: () => handlers.onFilter("PAID") },
    ],
    failed: [
      { id: "filter-failed", label: "Revisar fallidos", variant: "primary", run: () => handlers.onFilter("PENDING") },
    ],
    "all-clear": [
      { id: "filter-all", label: "Ver todos", variant: "muted", run: () => handlers.onFilter("ALL") },
    ],
  };

  return map[insight.id] ?? [];
}

export function getRecommendationQuickActions(
  rec: OperationalRecommendation,
  handlers: OrdersQuickAutomationHandlers
): QuickChipAction[] {
  return [
    {
      id: `rec-${rec.id}`,
      label: rec.ctaLabel,
      variant: "primary",
      run: () => rec.filter && handlers.onFilter(rec.filter),
    },
  ];
}

export function getAttentionQuickActions(
  item: OrdersAttentionItem,
  handlers: OrdersQuickAutomationHandlers
): QuickChipAction[] {
  const labels: Record<string, string> = {
    "stale-pending": "Filtrar pendientes",
    "print-pending": "Ver impresión",
    "awaiting-download": "Recordar descargas",
    failed: "Ver fallidos",
  };

  return [
    {
      id: `att-${item.id}`,
      label: labels[item.id] ?? "Ver pedidos",
      variant: item.tone === "rose" ? "primary" : "default",
      run: () => handlers.onFilter(item.filter),
    },
  ];
}

export function getEventQuickActions(
  event: OrderActivityEvent,
  order: PhotographerOrderRow | null,
  handlers: OrdersQuickAutomationHandlers
): QuickChipAction[] {
  const viewOrder: QuickChipAction = {
    id: "view-order",
    label: "Ver pedido",
    variant: "primary",
    run: () => {
      if (event.filter) handlers.onFilter(event.filter);
      handlers.onSelectOrder(event.orderKey);
    },
  };

  if (!order) {
    return event.kind === "pending_stale" || event.kind === "failed" ? [viewOrder] : [];
  }

  const whatsappUrl = !isDataProtected(order)
    ? buildCustomerWhatsappUrl(order.customerPhone, order.customerName, order.photographerInstagram)
    : null;
  const mailtoDownload = buildDownloadReminderMailto(order);
  const mailtoPending = buildPendingReminderMailto(order);
  const paid = isOrderPaid(order);
  const fk = getOrderFulfillmentKind(order);
  const canDeliver =
    order.source === "PRINT_ORDER" &&
    paid &&
    !["DELIVERED", "RETIRED", "CANCELED"].includes(order.status);

  switch (event.kind) {
    case "pending_stale":
      return [
        viewOrder,
        ...(whatsappUrl
          ? [{ id: "wa", label: "WhatsApp", variant: "whatsapp" as const, href: whatsappUrl }]
          : mailtoPending
            ? [{ id: "mail", label: "Enviar email", href: mailtoPending }]
            : []),
      ];
    case "failed":
      return [
        viewOrder,
        ...(whatsappUrl ? [{ id: "wa", label: "WhatsApp", variant: "whatsapp" as const, href: whatsappUrl }] : []),
      ];
    case "export":
    case "print_ready":
      return [
        viewOrder,
        {
          id: "export",
          label: "Exportar",
          variant: "primary",
          run: () => handlers.onExportOrder(order),
        },
      ];
    case "download":
      return [viewOrder];
    case "print_progress":
      return [
        viewOrder,
        ...(canDeliver
          ? [
              {
                id: "deliver",
                label: "Marcar entregado",
                variant: "success" as const,
                run: () => handlers.onMarkDelivered(order.id),
              },
            ]
          : []),
      ];
    case "payment":
    case "new_order":
    case "video":
    case "preventa":
      return [viewOrder];
    default:
      if (
        paid &&
        isDownloadAvailable(order) &&
        !order.downloadLinkViewedAt &&
        (fk === "DIGITAL" || fk === "MIXED" || order.hasDigitalItems)
      ) {
        return [
          viewOrder,
          {
            id: "remind",
            label: "Recordar descarga",
            variant: "primary",
            run: () => handlers.onFilter("DIGITAL"),
          },
          ...(whatsappUrl
            ? [{ id: "wa", label: "WhatsApp", variant: "whatsapp" as const, href: whatsappUrl }]
            : mailtoDownload
              ? [{ id: "mail", label: "Email", href: mailtoDownload }]
              : []),
        ];
      }
      return [viewOrder];
  }
}

export function getOrderDrawerQuickActions(
  order: PhotographerOrderRow,
  handlers: OrdersQuickAutomationHandlers
): QuickChipAction[] {
  const actions: QuickChipAction[] = [];
  const paid = isOrderPaid(order);
  const pending = isOrderPending(order);
  const fk = getOrderFulfillmentKind(order);
  const protectedData = isDataProtected(order);

  const whatsappUrl = !protectedData
    ? buildCustomerWhatsappUrl(order.customerPhone, order.customerName, order.photographerInstagram)
    : null;

  if (whatsappUrl) {
    actions.push({
      id: "whatsapp",
      label: "WhatsApp",
      variant: "whatsapp",
      href: whatsappUrl,
    });
  }

  if (pending && !protectedData) {
    const mailto = buildPendingReminderMailto(order);
    if (mailto) {
      actions.push({ id: "email-pending", label: "Email cliente", href: mailto });
    }
  }

  if (paid) {
    const hasD =
      order.source === "ALBUM_ORDER" &&
      (order.hasDigitalItems ?? (fk === "DIGITAL" || fk === "MIXED"));
    const hasP =
      order.source === "PRINT_ORDER" ||
      (order.hasPrintItems ?? (fk === "PRINT" || fk === "MIXED"));

    if (hasD) {
      const multiDigital = (order.digitalItemsCount ?? 0) > 1;
      actions.push({
        id: "download-digital",
        label: multiDigital ? "Descargar ZIP" : "Descargar",
        variant: "primary",
        run: () => handlers.onDownloadOrder(order, "DIGITAL"),
      });
      actions.push({
        id: "copy-digital",
        label: "Copiar link",
        run: () => handlers.onCopyDigitalLink(order),
      });
      if (!order.downloadLinkViewedAt) {
        const mailto = buildDownloadReminderMailto(order);
        if (mailto) {
          actions.push({ id: "remind-download", label: "Recordar descarga", href: mailto });
        }
      }
    }

    if (hasP) {
      actions.push({
        id: "export-print",
        label: "Exportar",
        variant: "primary",
        run: () => handlers.onExportOrder(order),
      });
      if (order.source === "PRINT_ORDER") {
        actions.push({
          id: "download-print",
          label: "Descargar ZIP",
          run: () => handlers.onDownloadOrder(order, "PRINT"),
        });
      }
    }

    if (
      order.source === "PRINT_ORDER" &&
      !["DELIVERED", "RETIRED", "CANCELED"].includes(order.status)
    ) {
      actions.push({
        id: "mark-delivered",
        label: "Marcar entregado",
        variant: "success",
        run: () => handlers.onMarkDelivered(order.id),
      });
    }
  }

  if (pending) {
    actions.push({
      id: "filter-pending",
      label: "Ver pendientes",
      variant: "muted",
      run: () => handlers.onFilter("PENDING"),
    });
  }

  return actions;
}

export function openOrderExport(order: PhotographerOrderRow) {
  if (typeof window === "undefined") return;
  const origin = window.location.origin;
  if (order.source === "PRINT_ORDER") {
    window.open(`${origin}/api/print-orders/${order.id}/export`, "_blank", "noopener,noreferrer");
  } else {
    window.open(`${origin}/api/fotografo/pedidos/${order.id}/export-print`, "_blank", "noopener,noreferrer");
  }
}
