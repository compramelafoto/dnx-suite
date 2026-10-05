import "server-only";
import { parseMpPayment, type MpPaymentFacts } from "./payment-facts";

/**
 * Lectura directa de pagos de Mercado Pago con el token de la institución.
 *
 * Existe aparte del adaptador de `@repo/payments` porque ese adaptador sanea la respuesta y
 * tira las comisiones, la fecha real de aprobación y lo devuelto, que es lo que Caja necesita.
 * Tocar el adaptador compartido afectaría a las otras apps del monorepo; esto es sólo lectura
 * y vive en FOTOFFICE. El cuerpo crudo nunca sale de esta función: se devuelve el resumen.
 */

const API = "https://api.mercadopago.com";

export class MpReadError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function getJson(token: string, path: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new MpReadError(`Mercado Pago respondió ${res.status} en ${path.split("?")[0]}`, res.status);
  }
  return (await res.json()) as Record<string, unknown>;
}

export async function fetchMpPayment(token: string, paymentId: string): Promise<MpPaymentFacts> {
  const raw = await getJson(token, `/v1/payments/${encodeURIComponent(paymentId)}`);
  return parseMpPayment(raw);
}

/**
 * Los pagos de la cuenta que cambiaron entre dos fechas (aprobaciones, devoluciones,
 * contracargos). Pagina sola hasta `maxResults`.
 */
export async function searchMpPaymentsUpdatedBetween(
  token: string,
  input: { from: Date; to: Date; maxResults?: number },
): Promise<MpPaymentFacts[]> {
  const limite = input.maxResults ?? 1000;
  const porPagina = 100;
  const salida: MpPaymentFacts[] = [];
  for (let offset = 0; offset < limite; offset += porPagina) {
    const q = new URLSearchParams({
      range: "date_last_updated",
      begin_date: input.from.toISOString(),
      end_date: input.to.toISOString(),
      sort: "date_last_updated",
      criteria: "asc",
      limit: String(porPagina),
      offset: String(offset),
    });
    const body = await getJson(token, `/v1/payments/search?${q.toString()}`);
    const filas = Array.isArray(body.results) ? body.results : [];
    for (const fila of filas) {
      if (typeof fila === "object" && fila !== null) {
        salida.push(parseMpPayment(fila as Record<string, unknown>));
      }
    }
    if (filas.length < porPagina) break;
  }
  return salida;
}
