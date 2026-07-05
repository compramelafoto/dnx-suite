export type AdminOrderViewSource = "PRINT_ORDER" | "ALBUM_ORDER";

export function buildAdminOrderViewUrl(
  orderId: number,
  source: AdminOrderViewSource,
  origin?: string
): string {
  const base = (origin ?? "").replace(/\/$/, "");
  return `${base}/admin/pedidos/${orderId}?source=${source}`;
}
