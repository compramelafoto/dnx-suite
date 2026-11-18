/**
 * Varios packs de preventa en UN solo pago de Mercado Pago (reglas puras, sin base ni red).
 *
 * Cada pack sigue siendo su propio pedido (`Order` PREVENTA_PACK): el canje y el diseño del
 * libro leen un solo pack por pedido. Los pedidos de la misma compra se agrupan en un
 * `OrderPaymentGroup` y se cobran con una preferencia de Checkout Pro con un ítem por pedido.
 * El pago lleva `external_reference = clf-preventa-grupo-<id>`.
 */

const PREFIJO_REFERENCIA = "clf-preventa-grupo-";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Pedidos armados hace más que esto no se agrupan (son de otra compra). */
export const ANTIGUEDAD_MAXIMA_PARA_AGRUPAR_MS = 2 * 60 * 60 * 1000;

export function esIdGrupoValido(id: string | null | undefined): id is string {
  return typeof id === "string" && UUID.test(id);
}

export function referenciaGrupoPreventa(grupoId: string): string {
  return `${PREFIJO_REFERENCIA}${grupoId}`;
}

/** Id del grupo si la referencia del pago es de un grupo de preventa; si no, null. */
export function grupoIdDesdeReferenciaPreventa(ref: string | null | undefined): string | null {
  if (typeof ref !== "string" || !ref.startsWith(PREFIJO_REFERENCIA)) return null;
  const id = ref.slice(PREFIJO_REFERENCIA.length);
  return esIdGrupoValido(id) ? id : null;
}

/** ¿El pago (por su referencia) es de este pedido, ya sea suelto o dentro de su grupo? */
export function referenciaEsDelPedido(
  ref: string | null | undefined,
  orderId: number,
  grupo?: { id: string; orderIds: number[] } | null,
): boolean {
  if (ref != null && String(ref).trim() === String(orderId)) return true;
  if (!grupo) return false;
  return grupoIdDesdeReferenciaPreventa(ref) === grupo.id && grupo.orderIds.includes(orderId);
}

// ---------------------------------------------------------------------------
// ¿Se pueden cobrar juntos?
// ---------------------------------------------------------------------------

export type PedidoParaAgrupar = {
  id: number;
  albumId: number;
  buyerEmail: string;
  status: string;
  origin: string;
  checkoutPaymentSource: string;
  isTest: boolean;
  currency: string;
  /** Pesos enteros (Order.totalCents guarda pesos). */
  totalCents: number;
  createdAt: Date;
  /** El pedido está atado al piloto de cobro dividido (no admite Checkout Pro común). */
  bloqueaCheckoutPro: boolean;
};

export type MotivoNoAgrupable =
  | "pocos_pedidos"
  | "pedido_inexistente"
  | "albumes_distintos"
  | "otro_comprador"
  | "no_es_preventa"
  | "no_es_mercado_pago"
  | "prueba"
  | "no_pagable"
  | "moneda"
  | "cobro_dividido"
  | "sin_monto"
  | "viejo";

export type ResultadoAgrupable =
  | { ok: true; orderIds: number[]; albumId: number; totalArs: number }
  | { ok: false; motivo: MotivoNoAgrupable; orderId?: number };

export function normalizarEmail(email: string | null | undefined): string {
  return String(email ?? "").trim().toLowerCase();
}

/**
 * Decide si estos pedidos se pueden cobrar en un solo pago. Cuando no, la pantalla vuelve a
 * los pagos encadenados (un pago por pack), que siguen funcionando igual que antes.
 */
export function validarPedidosParaAgrupar(params: {
  orderIdsPedidos: number[];
  pedidos: PedidoParaAgrupar[];
  buyerEmail: string;
  ahora: Date;
}): ResultadoAgrupable {
  const ids = [...new Set(params.orderIdsPedidos.filter((id) => Number.isInteger(id) && id > 0))].sort(
    (a, b) => a - b,
  );
  if (ids.length < 2) return { ok: false, motivo: "pocos_pedidos" };
  const porId = new Map(params.pedidos.map((p) => [p.id, p]));
  const email = normalizarEmail(params.buyerEmail);
  let albumId: number | null = null;
  let totalArs = 0;
  for (const id of ids) {
    const p = porId.get(id);
    if (!p) return { ok: false, motivo: "pedido_inexistente", orderId: id };
    if (albumId == null) albumId = p.albumId;
    if (p.albumId !== albumId) return { ok: false, motivo: "albumes_distintos", orderId: id };
    if (!email || normalizarEmail(p.buyerEmail) !== email) return { ok: false, motivo: "otro_comprador", orderId: id };
    if (p.origin !== "PREVENTA_PACK") return { ok: false, motivo: "no_es_preventa", orderId: id };
    if (p.checkoutPaymentSource !== "MERCADO_PAGO") return { ok: false, motivo: "no_es_mercado_pago", orderId: id };
    if (p.isTest) return { ok: false, motivo: "prueba", orderId: id };
    if (p.status !== "PENDING" && p.status !== "FAILED") return { ok: false, motivo: "no_pagable", orderId: id };
    if (String(p.currency || "ARS").toUpperCase() !== "ARS") return { ok: false, motivo: "moneda", orderId: id };
    if (p.bloqueaCheckoutPro) return { ok: false, motivo: "cobro_dividido", orderId: id };
    if (!Number.isFinite(p.totalCents) || p.totalCents <= 0) return { ok: false, motivo: "sin_monto", orderId: id };
    if (params.ahora.getTime() - p.createdAt.getTime() > ANTIGUEDAD_MAXIMA_PARA_AGRUPAR_MS) {
      return { ok: false, motivo: "viejo", orderId: id };
    }
    totalArs += Math.round(p.totalCents);
  }
  return { ok: true, orderIds: ids, albumId: albumId as number, totalArs };
}

/** Mismo conjunto de pedidos (sin importar el orden). */
export function mismosPedidos(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort((x, y) => x - y);
  const sb = [...b].sort((x, y) => x - y);
  return sa.every((v, i) => v === sb[i]);
}

// ---------------------------------------------------------------------------
// Armado de la preferencia
// ---------------------------------------------------------------------------

export type LineaCobroGrupo = {
  orderId: number;
  /** Nombre del pack para el renglón de Mercado Pago («Libro escolar»). */
  titulo: string;
  /** Pesos enteros que paga la familia por este pedido. */
  totalArs: number;
  /** Lo que se queda la plataforma (y el organizador) de este pedido, en pesos enteros. */
  comisionArs: number;
};

export type CobroGrupo = {
  items: Array<{ id: string; title: string; unitPrice: number }>;
  total: number;
  marketplaceFee: number;
  titulo: string;
};

/**
 * Un renglón por pedido; el total es la suma y la comisión de la plataforma es la suma de la
 * comisión de cada pedido (calculada con la misma lógica que cuando se paga suelto).
 */
export function armarCobroGrupo(lineas: LineaCobroGrupo[]): CobroGrupo {
  const ordenadas = [...lineas].sort((a, b) => a.orderId - b.orderId);
  const items = ordenadas.map((l) => {
    const titulo = l.titulo.trim() || "Pack de preventa";
    return {
      id: `ORD-ALBUM_ORDER-${l.orderId}`,
      title: `${titulo} - Pedido #${l.orderId}`.slice(0, 256),
      unitPrice: Math.max(0, Math.round(l.totalArs)),
    };
  });
  const total = items.reduce((s, it) => s + it.unitPrice, 0);
  const marketplaceFee = ordenadas.reduce((s, l) => s + Math.max(0, Math.round(l.comisionArs)), 0);
  const titulo = `Preventa: ${ordenadas.length} packs - Pedidos #${ordenadas.map((l) => l.orderId).join(", #")}`;
  // La comisión nunca puede superar lo cobrado (Mercado Pago rechaza la preferencia).
  return { items, total, marketplaceFee: Math.min(marketplaceFee, total), titulo: titulo.slice(0, 256) };
}

// ---------------------------------------------------------------------------
// Aviso de pago aprobado: qué pedidos se confirman
// ---------------------------------------------------------------------------

export type PedidoDelGrupo = {
  id: number;
  status: string;
  mpPaymentId: string | null;
  totalCents: number;
};

export type DecisionFinalizacionGrupo =
  | {
      accion: "finalizar";
      /** Se pasan a pagado con este pago (los demás ya estaban pagados con él). */
      aFinalizar: number[];
      yaPagados: number[];
    }
  | {
      accion: "ignorar";
      motivo: "referencia_ajena" | "no_aprobado" | "monto_distinto" | "moneda" | "pedidos_faltantes";
      detalle?: string;
    };

/**
 * Antes de tocar un pedido se confirma que el pago sea de ESTE grupo, esté aprobado y cubra
 * exactamente la suma de los pedidos (un pago por otro monto no confirma nada: se revisa a mano).
 */
export function decidirFinalizacionGrupo(params: {
  grupoId: string;
  orderIds: number[];
  paymentId: string;
  pago: { externalReference: string | null | undefined; status: string; monto: number; moneda?: string | null };
  pedidos: PedidoDelGrupo[];
}): DecisionFinalizacionGrupo {
  if (grupoIdDesdeReferenciaPreventa(params.pago.externalReference) !== params.grupoId) {
    return { accion: "ignorar", motivo: "referencia_ajena" };
  }
  if (params.pago.status !== "approved") return { accion: "ignorar", motivo: "no_aprobado", detalle: params.pago.status };
  if (params.pago.moneda && String(params.pago.moneda).toUpperCase() !== "ARS") {
    return { accion: "ignorar", motivo: "moneda", detalle: String(params.pago.moneda) };
  }
  const porId = new Map(params.pedidos.map((p) => [p.id, p]));
  const faltan = params.orderIds.filter((id) => !porId.has(id));
  if (faltan.length > 0) return { accion: "ignorar", motivo: "pedidos_faltantes", detalle: faltan.join(",") };
  const esperado = params.orderIds.reduce((s, id) => s + Math.round(porId.get(id)!.totalCents), 0);
  if (Math.round(Number(params.pago.monto)) !== esperado) {
    return { accion: "ignorar", motivo: "monto_distinto", detalle: `pagado=${params.pago.monto} esperado=${esperado}` };
  }
  const aFinalizar: number[] = [];
  const yaPagados: number[] = [];
  for (const id of [...params.orderIds].sort((a, b) => a - b)) {
    const p = porId.get(id)!;
    if (p.status === "PAID" && String(p.mpPaymentId ?? "") === String(params.paymentId)) yaPagados.push(id);
    // Pendiente, fallido o pagado con OTRO pago: la finalización de cada pedido sabe qué hacer
    // (en el último caso registra y avisa el cobro duplicado, como con los pedidos sueltos).
    else aFinalizar.push(id);
  }
  return { accion: "finalizar", aFinalizar, yaPagados };
}

/** Estado de Mercado Pago que anula todos los pedidos del grupo. */
export function reversionDelGrupo(
  mpStatus: string,
): null | "REFUNDED" | "CHARGED_BACK" | "REJECTED" | "CANCELLED" {
  if (mpStatus === "refunded") return "REFUNDED";
  if (mpStatus === "charged_back") return "CHARGED_BACK";
  if (mpStatus === "rejected") return "REJECTED";
  if (mpStatus === "cancelled") return "CANCELLED";
  return null;
}
