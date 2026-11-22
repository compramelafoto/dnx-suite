import { marcaPorHost, origenPublico } from "@/lib/marca";

/**
 * Host del pedido: el encabezado `Host` (como robots y sitemap), y si no viene, el de la URL.
 * Detrás del CDN `req.url` puede no traer el dominio con el que entró la persona.
 */
export function hostDelPedido(req: Request): string {
  return req.headers.get("host")?.trim() || new URL(req.url).host;
}

const HOSTS_DE_MARCA = new Set([
  "muestrasfotograficas.com", "www.muestrasfotograficas.com",
  "muestrasdearte.com", "www.muestrasdearte.com",
  "localhost", "127.0.0.1",
]);

/** Sólo los dominios de las dos marcas y los de desarrollo (`localhost`, `*.localhost`, 127.0.0.1). */
export function esHostDeMarca(host: string): boolean {
  const h = host.trim().toLowerCase().replace(/:\d+$/, "");
  return HOSTS_DE_MARCA.has(h) || /^[a-z0-9-]+(\.[a-z0-9-]+)*\.localhost$/.test(h);
}

/** `http:` o `https:` según `x-forwarded-proto` (el primero si hay varios); si no, el de la URL. */
function protocoloDelPedido(req: Request): string {
  const reenviado = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  return reenviado === "http" || reenviado === "https" ? `${reenviado}:` : new URL(req.url).protocol;
}

/**
 * Origen (protocolo + host) para armar redirecciones dentro del sitio. Un host que no es de una
 * marca nunca se refleja: en ese caso se usa el de la URL del pedido, como antes.
 */
export function origenDelPedido(req: Request): string {
  const host = req.headers.get("host")?.trim();
  if (!host || !esHostDeMarca(host)) return new URL(req.url).origin;
  return `${protocoloDelPedido(req)}//${host.toLowerCase()}`;
}

/**
 * Base (https://dominio) a la que vuelve el ingreso: la del dominio desde el que se entró.
 * Un host desconocido cae en fotografía, así que nunca se usa un host ajeno como base.
 */
export function baseDeIngreso(req: Request, env: Record<string, string | undefined> = process.env): string {
  return origenPublico(marcaPorHost(hostDelPedido(req)), env);
}
