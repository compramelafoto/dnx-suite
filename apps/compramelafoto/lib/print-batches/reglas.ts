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

/** Al cliente sólo se le avisa al entrar a «Listo para retirar». */
export function avisaAlCliente(anterior: string, nuevo: string): boolean {
  return nuevo === "READY_TO_PICKUP" && anterior !== "READY_TO_PICKUP";
}

/**
 * El lote se cierra cuando está recibido (o más) y todos los pedidos vigentes
 * que retira el cliente ya fueron entregados. Las filas quitadas no cuentan.
 */
export function loteCerrado(
  entries: Array<{ quitadoAt: Date | null; entregadoAt: Date | null; retiraCliente: boolean }>,
  estado: EstadoLote,
): boolean {
  if (estado === "ANULADO") return false;
  if (estado !== "RECIBIDO" && estado !== "CERRADO") return false;
  return entries
    .filter((e) => e.quitadoAt == null)
    .every((e) => !e.retiraCliente || e.entregadoAt != null);
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
