// Lógica pura (sin React) de la burbuja cuando la usa una persona que compra fotos.
// Apta para el navegador: sólo importa de src/ui.
import type { AlmacenSimple } from "./globito";

export type Audiencia = "fotografo" | "comprador";

/** Largo máximo de la página que se manda al servidor (el servidor rechaza las más largas). */
const MAX_PAGINA = 300;

/** Página actual con su búsqueda (`/pago/failure?orderId=8`), cortada a 300 caracteres. */
export function paginaActual(pathname: string, search: string): string {
  return (pathname + search).slice(0, MAX_PAGINA);
}

export function estadoUrlComprador(basePath: string, pathname: string, search: string): string {
  return `${basePath}/estado?pagePath=${encodeURIComponent(paginaActual(pathname, search))}`;
}

/** Prefijo de la marca en sessionStorage: el globito diferido se muestra una sola vez por visita. */
export const GLOBITO_VISTO_PREFIJO = "dnxbot:globito:";

/** false si el globito de esa campaña ya se mostró en esta visita. Sin almacenamiento (o si falla) → true. */
export function debeMostrarGlobitoDiferido(almacen: AlmacenSimple | null, campaign: string): boolean {
  try {
    return !almacen?.getItem(GLOBITO_VISTO_PREFIJO + campaign);
  } catch {
    return true;
  }
}

export function marcarGlobitoVisto(almacen: AlmacenSimple | null, campaign: string): void {
  try {
    almacen?.setItem(GLOBITO_VISTO_PREFIJO + campaign, "1");
  } catch {
    /* sin almacenamiento: no se recuerda */
  }
}

/** Texto que ve la persona después de tocar «Hablar con una persona». */
export function textoTicket(status: number, r: { ticketId?: number; reused?: boolean; error?: string }, audiencia: Audiencia): string {
  if (audiencia === "comprador") {
    if (r.ticketId) return r.reused ? `Ya tenés abierto el caso #${r.ticketId}. Te responden por mail.` : `Abrí el caso #${r.ticketId}. Te responden por mail.`;
    // El servidor explica qué falta (por ejemplo, el mail) o por qué no se pudo: se muestra tal cual.
    return typeof r.error === "string" && r.error.trim() ? r.error : "No pude abrir el caso. Probá de nuevo en un rato.";
  }
  return r.ticketId
    ? r.reused
      ? `Ya tenés abierto el pedido de soporte #${r.ticketId}. La respuesta te aparece en Soporte y te llega por mail.`
      : `Abrí el pedido de soporte #${r.ticketId}. La respuesta te aparece en Soporte y te llega por mail.`
    : status === 429 && r.error
      ? r.error
      : "No pude abrir el pedido. Escribinos desde Soporte.";
}
