/**
 * Reglas del pago simulado en la compra de la galería (`/a/[id]/comprar`) de las demos grabables.
 *
 * Funciones puras, sin base de datos: así se pueden probar solas. Quien las usa trae los datos.
 *
 * - Un álbum cuyo dueño es un usuario demo nunca cobra por Mercado Pago: el pedido se crea `isTest`
 *   y va a `/pago-simulado/[orderId]`.
 * - Solo puede comprar ahí el dueño del álbum (la sesión del fotógrafo demo) o alguien con la demo
 *   activa (la cookie de vuelta del admin de demos). Cualquier otra visita recibe un rechazo: el
 *   álbum demo no regala fotos.
 * - El pago simulado solo aprueba pedidos `isTest` que no sean de preventa, de álbumes de dueño demo.
 */

import { DEMO_TAG } from "@/lib/demos/identidad";

export type DuenoAlbum = { id: number | null; tags?: string[] | null } | null | undefined;

/** El álbum es de un usuario demo: su compra usa el pago simulado. */
export function albumUsaPagoSimulado(dueno: DuenoAlbum): boolean {
  return Boolean(dueno?.id && dueno.tags?.includes(DEMO_TAG));
}

/** Quién está comprando o pagando: su usuario (si tiene sesión) y si hay una demo activa. */
export type ActorDemo = { userId: number | null; demoActiva: boolean };

export function actorPuedeUsarPagoSimulado(dueno: DuenoAlbum, actor: ActorDemo): boolean {
  if (!albumUsaPagoSimulado(dueno)) return false;
  if (actor.demoActiva) return true;
  return actor.userId != null && actor.userId === dueno?.id;
}

export type PedidoParaSimular = {
  isTest: boolean;
  origin: string | null;
  status: string;
};

export type ResultadoGuardaGaleria =
  | { ok: true; yaPagado: boolean }
  | { ok: false; error: string };

/** Guarda completa antes de dejar PAID un pedido de galería con el pago simulado. */
export function evaluarPagoSimuladoGaleria(params: {
  pedido: PedidoParaSimular | null | undefined;
  dueno: DuenoAlbum;
  actor: ActorDemo;
}): ResultadoGuardaGaleria {
  const { pedido, dueno, actor } = params;
  if (!pedido) return { ok: false, error: "order_not_found" };
  if (!pedido.isTest) return { ok: false, error: "order_not_test" };
  if (pedido.origin === "PREVENTA_PACK") return { ok: false, error: "order_is_preventa" };
  if (!albumUsaPagoSimulado(dueno)) return { ok: false, error: "album_not_demo" };
  if (!actorPuedeUsarPagoSimulado(dueno, actor)) return { ok: false, error: "actor_not_allowed" };
  if (pedido.status === "PAID") return { ok: true, yaPagado: true };
  if (pedido.status !== "PENDING" && pedido.status !== "FAILED") {
    return { ok: false, error: `order_not_payable:${pedido.status}` };
  }
  return { ok: true, yaPagado: false };
}

/** Pantalla final de una compra de galería: el centro de descargas del pedido. */
export function rutaDescargaDelPedido(token: string | null | undefined): string | null {
  return token ? `/descargas/${token}` : null;
}
