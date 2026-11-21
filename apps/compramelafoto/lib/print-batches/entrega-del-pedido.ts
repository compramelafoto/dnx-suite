/**
 * QR del sobre de un pedido común (reglas puras, sin base): quién puede hacer qué con el pedido y
 * cómo se llama cada estado. La ruta `/api/pedido/entrega/[codigo]` llama a `accionesPermitidas`
 * antes de tocar nada: `marcarListoParaRetirar` y `marcarEntregado` no autorizan.
 */

export type AccionDelSobre = "LISTO" | "ENTREGADO" | "RECIBIDO_POR_CLIENTE";

/**
 * Quién abrió el QR:
 * - FOTOGRAFO: sesión del dueño del lote (`PrintBatch.photographerId`).
 * - LAB_ENLACE: cookie `lab_lote_<batchId>` cuyo hash coincide con el `tokenHash` del lote.
 * - LAB_CUENTA: cuenta de laboratorio cuyo `Lab.id` es el `labId` del lote.
 * - ANONIMO: cualquier otro (el cliente, o alguien que encontró el sobre).
 */
export type ActorDelSobre = "FOTOGRAFO" | "LAB_ENLACE" | "LAB_CUENTA" | "ANONIMO";

export const ACCIONES_DEL_SOBRE: readonly AccionDelSobre[] = ["LISTO", "ENTREGADO", "RECIBIDO_POR_CLIENTE"];

export function esAccionDelSobre(valor: unknown): valor is AccionDelSobre {
  return typeof valor === "string" && (ACCIONES_DEL_SOBRE as readonly string[]).includes(valor);
}

/** Estados en los que el pedido ya terminó: nadie lo mueve desde el QR. */
const TERMINADOS = new Set(["DELIVERED", "CANCELED", "RETIRED"]);
/** Estados desde los que el fotógrafo puede pasarlo a «Listo para retirar» (y avisar al cliente). */
const ANTES_DE_LISTO = new Set(["CREATED", "IN_PRODUCTION", "READY", "SHIPPED"]);

/**
 * Lo que puede hacer cada actor con el pedido del sobre:
 * - Fotógrafo dueño: «Listo para retirar» (antes de estarlo) y «Entregado», siempre que no esté
 *   terminado. También si retira el cliente en el laboratorio: el fotógrafo siempre puede mover
 *   cualquier paso a mano (por ejemplo, si el laboratorio no usa la plataforma); el correo sale con
 *   la variante de retiro en el laboratorio.
 * - Laboratorio (enlace o cuenta): sólo «Entregado», y sólo si retira el cliente en el laboratorio.
 * - Sin sesión (el cliente): «Confirmar que lo recibí» sólo con el pedido «Listo para retirar».
 */
export function accionesPermitidas(p: { actor: ActorDelSobre; retiraCliente: boolean; status: string }): AccionDelSobre[] {
  if (TERMINADOS.has(p.status)) return [];
  switch (p.actor) {
    case "FOTOGRAFO":
      return ANTES_DE_LISTO.has(p.status) ? ["LISTO", "ENTREGADO"] : ["ENTREGADO"];
    case "LAB_ENLACE":
    case "LAB_CUENTA":
      return p.retiraCliente ? ["ENTREGADO"] : [];
    case "ANONIMO":
      return p.status === "READY_TO_PICKUP" ? ["RECIBIDO_POR_CLIENTE"] : [];
    default:
      return [];
  }
}

/** Qué actor es, en orden: el dueño, después el laboratorio (cuenta o enlace), si no anónimo. */
export function actorDelSobre(p: { esDueno: boolean; esCuentaDelLab: boolean; tieneCookieDelLote: boolean }): ActorDelSobre {
  if (p.esDueno) return "FOTOGRAFO";
  if (p.esCuentaDelLab) return "LAB_CUENTA";
  if (p.tieneCookieDelLote) return "LAB_ENLACE";
  return "ANONIMO";
}

const ESTADOS: Record<string, string> = {
  CREATED: "En preparación",
  IN_PRODUCTION: "En el laboratorio",
  READY: "Listo en el laboratorio",
  READY_TO_PICKUP: "Listo para retirar",
  SHIPPED: "En camino",
  DELIVERED: "Entregado",
  RETIRED: "Entregado",
  CANCELED: "Cancelado",
};
export function textoDelEstadoDelPedido(status: string): string {
  return ESTADOS[status] ?? "En preparación";
}

/**
 * El código como llega en la URL. Next ya decodifica los parámetros; por si llega todavía
 * codificado se decodifica una vez, y un «%» suelto da null (código inválido) en vez de un error.
 */
export function codigoDeLaRuta(crudo: unknown): string | null {
  let t = String(crudo ?? "");
  try {
    t = decodeURIComponent(t);
  } catch {
    return null;
  }
  t = t.trim();
  return t ? t : null;
}

export const CODIGO_INVALIDO = "Este código no es válido.";
export const NO_PODES = "No podés hacer eso con este pedido.";

/** Lo que queda escrito en el historial del pedido según quién lo movió. */
export function notaDelHistorial(actor: ActorDelSobre, accion: AccionDelSobre): string {
  if (accion === "RECIBIDO_POR_CLIENTE") return "Confirmado por el cliente";
  if (accion === "LISTO") return "Listo para retirar (QR del sobre, fotógrafo)";
  return actor === "FOTOGRAFO" ? "Entregado por el fotógrafo (QR del sobre)" : "Entregado por el laboratorio (QR del sobre)";
}
