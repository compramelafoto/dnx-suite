/**
 * Normalización de la dirección de una noticia, para no proponer dos veces la misma aunque llegue
 * con otra forma (http/https, "www.", barra final, parámetros de campaña, #ancla). Módulo PURO.
 */

const PARAMETROS_DE_RASTREO = /^(utm_[a-z]+|fbclid|gclid|mc_cid|mc_eid|igshid|ref|ref_src|cmpid|s_cid|_ga)$/i;

/** Dirección normalizada, o null si no es una dirección http(s) válida. */
export function normalizarUrl(cruda: string | null | undefined): string | null {
  const texto = cruda?.trim();
  if (!texto) return null;
  let u: URL;
  try {
    u = new URL(texto);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  const host = u.hostname.toLowerCase().replace(/^www\./, "").replace(/^m\./, "");
  if (!host.includes(".")) return null;
  const params = [...u.searchParams.entries()]
    .filter(([k]) => !PARAMETROS_DE_RASTREO.test(k))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const consulta = params.length ? `?${new URLSearchParams(params).toString()}` : "";
  let ruta = u.pathname.replace(/\/{2,}/g, "/");
  if (ruta.length > 1) ruta = ruta.replace(/\/+$/, "");
  if (ruta === "/") ruta = "";
  return `https://${host}${u.port ? `:${u.port}` : ""}${ruta}${consulta}`;
}

/**
 * ¿Se puede bajar esta dirección desde el servidor sin riesgo? Sólo nombres de dominio públicos:
 * nada de IPs escritas a mano, `localhost` ni nombres internos (la dirección la elige el modelo).
 */
export function esDireccionPublica(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return false;
  if (u.username || u.password) return false;
  const host = u.hostname.toLowerCase();
  if (host.startsWith("[") || /^[\d.]+$/.test(host)) return false;
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return false;
  return host.includes(".");
}
