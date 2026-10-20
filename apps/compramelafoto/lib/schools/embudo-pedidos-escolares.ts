/**
 * Embudo de "Pedidos escolares": en qué paso de la línea de producción está cada pedido, desde
 * que la familia paga hasta que se le entrega.
 *
 * Es puro (sin base ni red): lo usa la pantalla del fotógrafo para los contadores, los filtros y
 * la acción principal de cada paso. Mezcla dos fuentes:
 *
 * - Tienda escolar (`PreCompraOrder` + sus ítems y diseños).
 * - Packs cobrados por fuera (`Order` PREVENTA_PACK importado del Excel, y sus pruebas DEMO): el
 *   diseño del canje es un `DesignProject` del pedido de canje.
 *
 * Un pedido con varias piezas (dos libritos, dos ítems) queda en el paso de la pieza MÁS
 * ATRASADA: el pedido no está listo hasta que lo está todo.
 */

export const PASOS_EMBUDO = [
  "POR_CANJEAR",
  "REVISAR_DISENO",
  "CAMBIOS_PEDIDOS",
  "PARA_IMPRIMIR",
  "EN_IMPRENTA",
  "PARA_ENTREGAR",
  "ENTREGADO",
] as const;

export type PasoEmbudo = (typeof PASOS_EMBUDO)[number];

/** Pedidos de la tienda escolar que todavía no entran (o ya salieron) de la línea. */
export type FueraDelEmbudo = "PAGO_PENDIENTE" | "CANCELADO";

export type UbicacionEnEmbudo = PasoEmbudo | FueraDelEmbudo;

export const INFO_PASOS: Record<PasoEmbudo, { numero: number; titulo: string; ayuda: string }> = {
  POR_CANJEAR: {
    numero: 1,
    titulo: "Por canjear",
    ayuda: "Pagaron, pero la familia todavía no eligió sus fotos.",
  },
  REVISAR_DISENO: {
    numero: 2,
    titulo: "Revisar diseño",
    ayuda: "La familia ya eligió: el librito está armado y espera que lo mires.",
  },
  CAMBIOS_PEDIDOS: {
    numero: 3,
    titulo: "Cambios pedidos",
    ayuda: "Le pediste algo a la familia y estás esperando su respuesta.",
  },
  PARA_IMPRIMIR: {
    numero: 4,
    titulo: "Para imprimir",
    ayuda: "Aprobado: falta mandarlo a imprimir.",
  },
  EN_IMPRENTA: {
    numero: 5,
    titulo: "En imprenta",
    ayuda: "Se está imprimiendo.",
  },
  PARA_ENTREGAR: {
    numero: 6,
    titulo: "Para entregar",
    ayuda: "Impreso y en la escuela, falta dárselo a la familia.",
  },
  ENTREGADO: {
    numero: 7,
    titulo: "Entregado",
    ayuda: "La familia ya lo recibió (o era sólo digital).",
  },
};

export const INFO_FUERA: Record<FueraDelEmbudo, string> = {
  PAGO_PENDIENTE: "Pago pendiente",
  CANCELADO: "Cancelado",
};

export function esPasoEmbudo(v: unknown): v is PasoEmbudo {
  return typeof v === "string" && (PASOS_EMBUDO as readonly string[]).includes(v);
}

function indice(p: PasoEmbudo): number {
  return PASOS_EMBUDO.indexOf(p);
}

/** El paso más atrasado de una lista (la lista no puede estar vacía). */
export function pasoMasAtrasado(pasos: PasoEmbudo[]): PasoEmbudo {
  return pasos.reduce((a, b) => (indice(b) < indice(a) ? b : a));
}

/**
 * Paso según el estado del diseño (`DesignProject.status`). `null` si el estado no dice nada
 * (no debería pasar; quien llama decide).
 */
export function pasoDeEstadoDiseno(status: string | null | undefined): PasoEmbudo | null {
  switch (status) {
    case "PENDING_PHOTOGRAPHER_APPROVAL":
      return "REVISAR_DISENO";
    case "NEEDS_ADJUSTMENT":
      return "CAMBIOS_PEDIDOS";
    // Aprobado sin archivo (se reintenta) o aprobado con archivo: en los dos casos lo que sigue
    // es imprimir.
    case "APPROVED_FOR_EXPORT":
    case "EXPORTED":
      return "PARA_IMPRIMIR";
    default:
      return null;
  }
}

/**
 * Un diseño tal como lo ve el embudo. Las fechas de imprenta y entrega llegan con los lotes de
 * impresión (tanda 2): hoy no existen en la base y vienen `undefined`, pero la cuenta ya las
 * contempla para que sólo haya que pasarlas desde la API.
 */
export type DisenoParaEmbudo = {
  status: string | null | undefined;
  sentToPrintAt?: Date | string | null;
  printedAt?: Date | string | null;
  deliveredAt?: Date | string | null;
};

/**
 * Paso de un diseño. Sólo un diseño aprobado avanza por imprenta y entrega: si se tocó después
 * de aprobarlo vuelve a revisión y las fechas viejas no cuentan.
 */
export function pasoDeDiseno(d: DisenoParaEmbudo): PasoEmbudo | null {
  const paso = pasoDeEstadoDiseno(d.status);
  if (paso !== "PARA_IMPRIMIR") return paso;
  if (d.deliveredAt) return "ENTREGADO";
  if (d.printedAt) return "PARA_ENTREGAR";
  if (d.sentToPrintAt) return "EN_IMPRENTA";
  return "PARA_IMPRIMIR";
}

export type ItemTiendaEscolar = {
  /** `PreCompraOrderItem.status`. */
  status: string;
  /** El diseño del ítem, si tiene. */
  diseno: DisenoParaEmbudo | null;
};

/**
 * Paso de un ítem de la tienda escolar.
 *
 * Orden de lectura: primero la cadena física (imprenta → escuela → entregado), que es lo último
 * que pasa; después el diseño; por último el estado del ítem para los que no tienen diseño.
 *
 * `EXPORTED` en el ítem lo pone la aprobación del diseño ("el archivo está listo"), no la
 * imprenta: por eso es "Para imprimir", y "Iniciar impresión" lo pasa a `PHYSICAL_IN_PROGRESS`.
 */
export function pasoDeItemTienda(item: ItemTiendaEscolar): PasoEmbudo {
  if (item.status === "DELIVERED") return "ENTREGADO";
  if (item.status === "AT_SCHOOL") return "PARA_ENTREGAR";
  if (item.status === "PHYSICAL_IN_PROGRESS") return "EN_IMPRENTA";

  const porDiseno = item.diseno ? pasoDeDiseno(item.diseno) : null;
  if (porDiseno) return porDiseno;

  switch (item.status) {
    case "EXPORTED":
    case "APPROVED":
      return "PARA_IMPRIMIR";
    case "NEEDS_CHANGES":
      return "CAMBIOS_PEDIDOS";
    // La familia ya eligió: falta (generar y) revisar el diseño.
    case "READY_TO_DESIGN":
    case "DESIGN_SUBMITTED":
      return "REVISAR_DISENO";
    // WAITING_SELFIE, WAITING_UPLOAD, APPROVED_BY_MATCH, WAITING_SELECTION: la familia todavía
    // no terminó de elegir.
    default:
      return "POR_CANJEAR";
  }
}

export type PedidoParaEmbudo =
  | {
      kind: "TIENDA_ESCOLAR";
      /** `PreCompraOrder.status`: CREATED, PAID_HELD, CANCELED. */
      orderStatus: string;
      items: ItemTiendaEscolar[];
    }
  | {
      kind: "PACK_EXTERNO";
      /** Ya tiene pedido de canje (la familia eligió sus fotos). */
      canjeado: boolean;
      /** Los diseños del canje (uno por librito). */
      disenos: DisenoParaEmbudo[];
      /** El canje incluye copias impresas o cuadros (no sólo digitales). */
      tieneCopiasFisicas: boolean;
    };

/**
 * Dónde está un pedido en la línea.
 *
 * Pack cobrado por fuera, canjeado y SIN diseño (pack sin librito): si lleva copias impresas
 * queda "Para imprimir"; si es sólo digital ya está "Entregado", porque la familia lo descarga al
 * canjear y no hay nada más que hacer. "En imprenta", "Para entregar" y "Entregado" con librito
 * salen de las fechas del diseño (`sentToPrintAt`, `printedAt`, `deliveredAt`), que llegan con
 * los lotes de impresión (tanda 2).
 */
export function ubicarPedido(p: PedidoParaEmbudo): UbicacionEnEmbudo {
  if (p.kind === "PACK_EXTERNO") {
    if (!p.canjeado) return "POR_CANJEAR";
    if (p.disenos.length === 0) return p.tieneCopiasFisicas ? "PARA_IMPRIMIR" : "ENTREGADO";
    // Un diseño en un estado desconocido se trata como "para revisar": mejor mirarlo de más.
    return pasoMasAtrasado(p.disenos.map((d) => pasoDeDiseno(d) ?? "REVISAR_DISENO"));
  }

  if (p.orderStatus === "CANCELED") return "CANCELADO";
  if (p.orderStatus !== "PAID_HELD") return "PAGO_PENDIENTE";
  if (p.items.length === 0) return "POR_CANJEAR";
  return pasoMasAtrasado(p.items.map(pasoDeItemTienda));
}

/** Cuántos pedidos hay en cada paso (y fuera de la línea). */
export function contarPorPaso(ubicaciones: UbicacionEnEmbudo[]): Record<UbicacionEnEmbudo, number> {
  const base = Object.fromEntries(
    [...PASOS_EMBUDO, "PAGO_PENDIENTE", "CANCELADO"].map((k) => [k, 0]),
  ) as Record<UbicacionEnEmbudo, number>;
  for (const u of ubicaciones) base[u] += 1;
  return base;
}

/**
 * Los diseños para revisar "de corrido", en el orden de la lista y sin repetir. Sólo los que
 * esperan revisión: un pedido con dos libritos puede tener uno aprobado y otro pendiente.
 */
export function disenosParaRevisar(
  filas: Array<{ disenos: Array<{ id: number | null; status: string | null }> }>,
): number[] {
  const vistos = new Set<number>();
  const ids: number[] = [];
  for (const f of filas) {
    for (const d of f.disenos) {
      if (d.id == null || d.status !== "PENDING_PHOTOGRAPHER_APPROVAL" || vistos.has(d.id)) continue;
      vistos.add(d.id);
      ids.push(d.id);
    }
  }
  return ids;
}

/**
 * Los packs cobrados por fuera que todavía no se canjearon, agrupados por álbum, para el aviso
 * "ya están las fotos" de la lista que se ve (los marcados o los del curso filtrado). Las pruebas
 * DEMO no van: nunca reciben correos.
 */
export function packsPendientesPorAlbum(
  filas: Array<{
    id: number;
    kind?: string;
    isDemo?: boolean;
    redemptionOrderId?: number | null;
    album: { id: number } | null;
  }>,
): Map<number, number[]> {
  const out = new Map<number, number[]>();
  for (const f of filas) {
    if (f.kind !== "PACK_EXTERNO" || f.isDemo || !f.album || f.redemptionOrderId != null) continue;
    const ids = out.get(f.album.id) ?? [];
    if (!ids.includes(f.id)) ids.push(f.id);
    out.set(f.album.id, ids);
  }
  return out;
}

/** Texto del curso como se muestra ("5° A"). */
export function textoCurso(curso: { name: string; division: string | null } | null | undefined): string | null {
  if (!curso?.name?.trim()) return null;
  return `${curso.name.trim()}${curso.division?.trim() ? ` ${curso.division.trim()}` : ""}`;
}
