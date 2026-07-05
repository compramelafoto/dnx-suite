import {
  resolveOrderDigitalDownloadLinks,
  type OrderDigitalDownloadLinks,
} from "@/lib/digital-download/resolve-order-digital-links";

export type { OrderDigitalDownloadLinks as ClientDigitalDownloadLinks };

export async function resolveOrderClientViewLinks(
  orderId: number,
  baseUrl: string
): Promise<OrderDigitalDownloadLinks | null> {
  return resolveOrderDigitalDownloadLinks(orderId, baseUrl, "admin_client_view");
}
