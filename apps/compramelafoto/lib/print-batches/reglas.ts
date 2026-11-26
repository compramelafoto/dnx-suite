/**
 * Reglas puras del panel de impresiones (lotes): quién puede mover un lote de
 * estado, en qué estado queda el pedido espejo y qué pedidos pueden entrar.
 * Sin Prisma ni base: los nombres de estado coinciden con el enum PrintBatchEstado.
 */

export type EstadoLote =
  | "ARMADO"
  | "ENVIADO"
  | "EN_PRODUCCION"
  | "LISTO"
  | "DESPACHADO"
  | "RECIBIDO"
  | "CERRADO"
  | "ANULADO";

export type QuienMueve = "FOTOGRAFO" | "LABORATORIO";
export type EntregaLote = "RETIRA_FOTOGRAFO" | "ENVIA_LAB";

/** Orden del recorrido normal de un lote. */
const ORDEN: readonly EstadoLote[] = [
  "ARMADO",
  "ENVIADO",
  "EN_PRODUCCION",
  "LISTO",
  "DESPACHADO",
  "RECIBIDO",
  "CERRADO",
];

/** Estados entre los que el laboratorio puede avanzar (siempre hacia adelante). */
const TRAMO_DEL_LABORATORIO: readonly EstadoLote[] = ["ENVIADO", "EN_PRODUCCION", "LISTO", "DESPACHADO"];

export function puedeMover(
  desde: EstadoLote,
  hacia: EstadoLote,
  quien: QuienMueve,
  entrega: EntregaLote,
): boolean {
  if (desde === hacia) return false;
  if (desde === "CERRADO" || desde === "ANULADO") return false;
  if (hacia === "DESPACHADO" && entrega !== "ENVIA_LAB") return false;

  if (quien === "FOTOGRAFO") {
    if (hacia === "ANULADO") return desde === "ARMADO";
    const i = ORDEN.indexOf(desde);
    const j = ORDEN.indexOf(hacia);
    return i >= 0 && j > i;
  }

  const i = TRAMO_DEL_LABORATORIO.indexOf(desde);
  const j = TRAMO_DEL_LABORATORIO.indexOf(hacia);
  return i >= 0 && j > i;
}

export type EstadoPedidoEspejo = "CREATED" | "IN_PRODUCTION" | "READY" | "READY_TO_PICKUP";

/** Estado que se refleja en el pedido espejo según el estado del lote; null = no se toca. */
export function estadoDelPedidoPara(lote: EstadoLote, retiraCliente: boolean): EstadoPedidoEspejo | null {
  switch (lote) {
    case "EN_PRODUCCION":
      return "IN_PRODUCTION";
    case "LISTO":
      return retiraCliente ? "READY_TO_PICKUP" : "READY";
    case "RECIBIDO":
      return retiraCliente ? null : "READY_TO_PICKUP";
    case "ENVIADO":
      return "CREATED";
    default:
      return null;
  }
}

/**
 * Estado del pedido espejo al mover el lote de `desde` a `hacia`: el último no nulo de los estados
 * recorridos (un salto ENVIADO → RECIBIDO pasa por LISTO). Si `desde === hacia` se recalcula desde
 * el principio, para reparar pedidos que quedaron atrás. null = no se toca.
 */
export function estadoDelPedidoEnElTramo(desde: EstadoLote, hacia: EstadoLote, retiraCliente: boolean): EstadoPedidoEspejo | null {
  const j = ORDEN.indexOf(hacia);
  if (j < 0) return null;
  const i = desde === hacia ? 0 : ORDEN.indexOf(desde) + 1;
  let estado: EstadoPedidoEspejo | null = null;
  for (const e of ORDEN.slice(i, j + 1)) estado = estadoDelPedidoPara(e, retiraCliente) ?? estado;
  return estado;
}

/** Al cliente sólo se le avisa al entrar a «Listo para retirar». */
export function avisaAlCliente(anterior: string, nuevo: string): boolean {
  return nuevo === "READY_TO_PICKUP" && anterior !== "READY_TO_PICKUP";
}

/** Estados del pedido espejo que ya cuentan como entregado (también por la ruta vieja de pedidos). */
export const ESPEJO_ENTREGADO: readonly string[] = ["DELIVERED", "RETIRED"];

/** Una entrada del lote está entregada si tiene `entregadoAt` o su espejo ya figura entregado. */
export function entradaEntregada(e: { entregadoAt: Date | null; estadoPedido?: string | null }): boolean {
  return e.entregadoAt != null || (e.estadoPedido != null && ESPEJO_ENTREGADO.includes(e.estadoPedido));
}

/**
 * El lote se cierra sólo cuando todos sus pedidos vigentes (sin quitar) están entregados, sea quien
 * sea el que retira: recibir el lote no alcanza para los que retira el fotógrafo (tiene que
 * entregárselos a sus clientes). Sin pedidos vigentes o antes de LISTO: no cierra.
 */
export function loteCerrado(
  entries: Array<{ quitadoAt: Date | null; entregadoAt: Date | null; estadoPedido?: string | null }>,
  estado: EstadoLote,
): boolean {
  if (estado !== "LISTO" && estado !== "DESPACHADO" && estado !== "RECIBIDO" && estado !== "CERRADO") {
    return false;
  }
  const vigentes = entries.filter((e) => e.quitadoAt == null);
  if (vigentes.length === 0) return false;
  return vigentes.every(entradaEntregada);
}

export type PedidoCandidato = {
  orderStatus: string;
  esDemo: boolean;
  esCanjeVoucher: boolean;
  copiasSueltas: number;
  enLoteVivo: boolean;
};

/** Devuelve por qué un pedido no puede entrar a un lote, o null si entra. */
export function motivoParaNoEntrar(p: PedidoCandidato): string | null {
  if (p.orderStatus !== "PAID") return "El pedido todavía no está pagado.";
  if (p.esDemo) return "Es un pedido de prueba.";
  if (p.esCanjeVoucher) return "Es un canje: va por Pedidos escolares.";
  if (p.copiasSueltas <= 0) return "No tiene copias sueltas para imprimir.";
  if (p.enLoteVivo) return "Ya está en otro lote.";
  return null;
}

/**
 * Cada pedido vive en un solo panel. Los de colegio (el pack de preventa, su canje, o un pedido que
 * ya tiene avance en la línea escolar) se imprimen desde «Pedidos escolares»; el resto, desde
 * «Impresiones». Es la misma frontera que usa `/api/fotografo/school-orders`: packs `PREVENTA_PACK`
 * y su `redemptionOrderId`, que es el pedido con `redeemsOrderId`.
 */
export function vaPorPedidosEscolares(p: {
  origin: string | null;
  redeemsOrderId: number | null;
  enLineaEscolar: boolean;
  /**
   * El pedido canjea un combo de impresas cobrado por fuera («3 impresas de regalo», como las
   * comuniones del álbum 1649). Ese combo no es de colegio: «Pedidos escolares» no lo lista, así
   * que su canje se imprime desde «Impresiones». Sin este dato el canje quedaba en ningún panel.
   */
  canjeaComboDeImpresas?: boolean;
}): boolean {
  if (p.enLineaEscolar) return true;
  if (p.origin === "PREVENTA_PACK" || p.origin === "PACK_REDEMPTION") return true;
  if (p.redeemsOrderId != null) return !p.canjeaComboDeImpresas;
  return false;
}

/** Tipos de combo de impresas cobrado por fuera (`redemptionPaymentRefsJson.kind` del pack canjeado). */
const KINDS_COMBO_DE_IMPRESAS = new Set(["EXTERNAL_PREPAID_PRINT_CREDIT", "EXTERNAL_SHARED_GIFT_LINK"]);

/** ¿El pack canjeado es un combo de impresas (y no un pack de colegio)? Lee su `redemptionPaymentRefsJson`. */
export function esComboDeImpresas(refs: unknown): boolean {
  if (!refs || typeof refs !== "object") return false;
  const kind = (refs as Record<string, unknown>).kind;
  return typeof kind === "string" && KINDS_COMBO_DE_IMPRESAS.has(kind);
}
