import { buildCustomerWhatsappUrl } from "./photographer-order-contact";
import {
  getOrderFulfillmentKind,
  isDataProtected,
  isDownloadAvailable,
  isOrderPaid,
  rowKey,
  type PhotographerOrderRow,
} from "./photographer-order-types";

export function resolveSelectedOrders(
  orders: PhotographerOrderRow[],
  selectedKeys: Set<string>
): PhotographerOrderRow[] {
  if (selectedKeys.size === 0) return [];
  return orders.filter((o) => selectedKeys.has(rowKey(o)));
}

export function getBulkDownloadableOrders(orders: PhotographerOrderRow[]): PhotographerOrderRow[] {
  return orders.filter(isDownloadAvailable);
}

export function getBulkExportableOrders(orders: PhotographerOrderRow[]): PhotographerOrderRow[] {
  return orders.filter((o) => {
    if (!isOrderPaid(o) || isDataProtected(o)) return false;
    if (o.source === "PRINT_ORDER") return true;
    const fk = getOrderFulfillmentKind(o);
    return fk === "PRINT" || fk === "MIXED" || Boolean(o.hasPrintItems);
  });
}

export function getBulkDeliverableOrders(orders: PhotographerOrderRow[]): PhotographerOrderRow[] {
  return orders.filter(
    (o) =>
      o.source === "PRINT_ORDER" &&
      isOrderPaid(o) &&
      o.status !== "DELIVERED" &&
      o.status !== "RETIRED" &&
      o.status !== "CANCELED"
  );
}

export function getBulkWhatsappOrder(orders: PhotographerOrderRow[]): PhotographerOrderRow | null {
  const eligible = orders.filter(
    (o) =>
      !isDataProtected(o) &&
      buildCustomerWhatsappUrl(o.customerPhone, o.customerName, o.photographerInstagram)
  );
  return eligible.length === 1 ? eligible[0]! : null;
}

export function getBulkWhatsappUrl(order: PhotographerOrderRow): string | null {
  if (isDataProtected(order)) return null;
  return buildCustomerWhatsappUrl(order.customerPhone, order.customerName, order.photographerInstagram);
}
