/**
 * Dirección de la ficha de entrega escolar (`/escolar/entrega/[token]`) a la que apunta el QR de
 * cada etiqueta. La usan las etiquetas por pedido y las etiquetas de los lotes de impresión.
 */

export function baseAppUrl(env: Record<string, string | undefined> = process.env): string {
  const raw = env.NEXT_PUBLIC_APP_URL || env.APP_URL || "http://localhost:3000";
  return raw.replace(/\/$/, "");
}

export function urlDeEntregaEscolar(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/$/, "")}/escolar/entrega/${encodeURIComponent(token)}`;
}
