/**
 * "Pantalla de pedidos": tablero de los pedidos escolares, una columna por paso de la línea de
 * producción, para trabajar en la computadora o mostrar en un televisor o una videollamada.
 * Cada pedido es una tarjeta chica: al tocarla se abre su detalle y se puede arrastrar al paso
 * siguiente (sólo cuando ese paso depende del fotógrafo).
 *
 * Es puro (sin base, red ni navegador): la pantalla le pasa los pedidos y hace los pedidos a la
 * API que acá se describen.
 */

import {
  INFO_PASOS,
  PASOS_EMBUDO,
  contarPorPaso,
  esPasoEmbudo,
  type PasoEmbudo,
  type UbicacionEnEmbudo,
} from "./embudo-pedidos-escolares";

/** Cada cuánto vuelve a pedir los pedidos. */
export const SEGUNDOS_ENTRE_ACTUALIZACIONES = 15;

export type ContadorPaso = {
  paso: PasoEmbudo;
  numero: number;
  titulo: string;
  cantidad: number;
};

/** Los siete contadores, en el orden de la línea (los pedidos fuera de la línea no cuentan). */
export function contadoresPorPaso(ubicaciones: UbicacionEnEmbudo[]): ContadorPaso[] {
  const conteo = contarPorPaso(ubicaciones);
  return PASOS_EMBUDO.map((paso) => ({
    paso,
    numero: INFO_PASOS[paso].numero,
    titulo: INFO_PASOS[paso].titulo,
    cantidad: conteo[paso],
  }));
}

/**
 * Los pedidos que van en tarjetas, ordenados por paso (los más atrasados primero) y, dentro de
 * cada paso, por nombre. Fuera de la línea (pago pendiente, cancelado) no se muestran; los
 * entregados tampoco, salvo que se pidan: ya no hay nada que hacer con ellos y sólo suman páginas
 * (igual se ven en su contador).
 */
export function pedidosParaTarjetas<T extends { paso: UbicacionEnEmbudo; nombre: string }>(
  pedidos: T[],
  opciones: { incluirEntregados?: boolean } = {},
): T[] {
  return pedidos
    .filter((p): p is T & { paso: PasoEmbudo } => esPasoEmbudo(p.paso))
    .filter((p) => opciones.incluirEntregados || p.paso !== "ENTREGADO")
    .map((p, i) => ({ p, i }))
    .sort(
      (a, b) =>
        PASOS_EMBUDO.indexOf(a.p.paso) - PASOS_EMBUDO.indexOf(b.p.paso) ||
        a.p.nombre.localeCompare(b.p.nombre, "es", { sensitivity: "base", numeric: true }) ||
        a.i - b.i,
    )
    .map(({ p }) => p);
}

/** Lo que el tablero necesita de un pedido para saber si se puede adelantar. */
export type PedidoParaAdelantar = {
  paso: UbicacionEnEmbudo;
  isDemo?: boolean;
  disenos: Array<{
    id: number;
    status: string;
    emptySlots?: number;
    sentToPrintAt?: string | null;
    printedAt?: string | null;
    deliveredAt?: string | null;
  }>;
  /** Ítems de la tienda escolar (los packs cobrados por fuera no tienen). */
  items?: Array<{ id: number; status: string }>;
  /** Pedido de canje de un pack cobrado por fuera. */
  redemptionOrderId?: number | null;
  /** Sólo en los canjes de copias impresas sin librito: su avance por la imprenta. */
  copias?: { sentToPrintAt?: string | null; printedAt?: string | null; deliveredAt?: string | null } | null;
};

/** Un pedido a la API que hace avanzar el pedido. */
export type LlamadaAdelanto = { url: string; body?: Record<string, unknown> };

export type PlanDeAdelanto =
  | {
      puede: true;
      destino: PasoEmbudo;
      /** Qué va a pasar, para la confirmación ("Vas a …"). */
      explicacion: string;
      /** Aviso extra antes de confirmar (huecos sin foto). */
      aviso: string | null;
      llamadas: LlamadaAdelanto[];
    }
  | { puede: false; motivo: string };

const APROBADO = new Set(["APPROVED_FOR_EXPORT", "EXPORTED"]);

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/**
 * Cómo se pasa un pedido al paso siguiente, con las mismas acciones que Pedidos escolares. Sólo
 * se avanza de a un paso, y sólo en los pasos que dependen del fotógrafo: "Por canjear" y
 * "Cambios pedidos" esperan a la familia, y "Entregado" es el final.
 *
 * - Revisar diseño → Para imprimir: aprueba los diseños pendientes (a la familia le llega el
 *   correo de "librito aprobado", salvo en las DEMO).
 * - Para imprimir → En imprenta: arma un lote con sus librititos aprobados y, si es un pedido de
 *   sólo copias sueltas, con sus copias; si es de la tienda escolar sin librito, marca sus ítems.
 * - En imprenta → Para entregar: marca impresos los librititos (o los ítems "en la escuela").
 * - Para entregar → Entregado: marca entregados los librititos (o los ítems).
 */
export function planDeAdelanto(p: PedidoParaAdelantar): PlanDeAdelanto {
  const items = p.items ?? [];
  // Pedido de sólo copias (sin librito): se mueve por su pedido de canje.
  const copiasSi = (cumple: (c: NonNullable<PedidoParaAdelantar["copias"]>) => boolean): number[] =>
    p.copias && p.redemptionOrderId && cumple(p.copias) ? [p.redemptionOrderId] : [];
  const trabajos = (libritos: number, copias: number) =>
    [
      libritos ? plural(libritos, "librito", "librititos") : "",
      copias ? plural(copias, "pedido de copias sueltas", "pedidos de copias sueltas") : "",
    ]
      .filter(Boolean)
      .join(" y ");
  const itemsEn = (estado: string) => items.filter((i) => i.status === estado);
  const correo = p.isDemo ? "Es una DEMO: no se le manda correo a nadie." : "A la familia le llega un correo avisando que su librito está aprobado.";

  switch (p.paso) {
    case "POR_CANJEAR":
      return { puede: false, motivo: "Espera a la familia: todavía no eligió sus fotos." };
    case "CAMBIOS_PEDIDOS":
      return { puede: false, motivo: "Espera a la familia: le pediste cambios y todavía no respondió." };
    case "ENTREGADO":
      return { puede: false, motivo: "Ya está entregado: es el último paso." };
    case "PAGO_PENDIENTE":
    case "CANCELADO":
      return { puede: false, motivo: "Está fuera de la línea de producción." };

    case "REVISAR_DISENO": {
      const pendientes = p.disenos.filter((d) => d.status === "PENDING_PHOTOGRAPHER_APPROVAL");
      if (pendientes.length === 0) {
        return {
          puede: false,
          motivo: "Todavía no tiene un diseño para aprobar: generalo desde Pedidos escolares.",
        };
      }
      const huecos = pendientes.reduce((n, d) => n + (d.emptySlots ?? 0), 0);
      return {
        puede: true,
        destino: "PARA_IMPRIMIR",
        explicacion: `Vas a aprobar ${plural(pendientes.length, "diseño", "diseños")} sin abrirlo. ${correo}`,
        aviso: huecos > 0 ? `Ojo: ${plural(huecos, "lugar queda", "lugares quedan")} sin foto y van a salir vacíos.` : null,
        llamadas: pendientes.map((d) => ({ url: `/api/fotografo/disenos/${d.id}/approve`, body: {} })),
      };
    }

    case "PARA_IMPRIMIR": {
      const ids = p.disenos.filter((d) => APROBADO.has(d.status) && !d.sentToPrintAt).map((d) => d.id);
      const copias = copiasSi((c) => !c.sentToPrintAt);
      if (ids.length > 0 || copias.length > 0) {
        return {
          puede: true,
          destino: "EN_IMPRENTA",
          explicacion: `Vas a mandar a imprimir ${trabajos(ids.length, copias.length)} en un lote nuevo. Después bajás el ZIP desde el pedido o desde Pedidos escolares.`,
          aviso: null,
          llamadas: [{ url: "/api/fotografo/escolar/lotes", body: { ids, copias } }],
        };
      }
      const exportados = itemsEn("EXPORTED");
      if (exportados.length > 0) {
        return {
          puede: true,
          destino: "EN_IMPRENTA",
          explicacion: "Vas a marcarlo en imprenta.",
          aviso: null,
          llamadas: exportados.map((i) => ({ url: `/api/fotografo/school-order-items/${i.id}/start-physical-fulfillment` })),
        };
      }
      return { puede: false, motivo: "No encontré qué mandar a imprimir: revisalo en Pedidos escolares." };
    }

    case "EN_IMPRENTA": {
      const ids = p.disenos.filter((d) => d.sentToPrintAt && !d.printedAt).map((d) => d.id);
      const copias = copiasSi((c) => Boolean(c.sentToPrintAt) && !c.printedAt);
      if (ids.length > 0 || copias.length > 0) {
        return {
          puede: true,
          destino: "PARA_ENTREGAR",
          explicacion: `Vas a marcar impreso: ${trabajos(ids.length, copias.length)}.`,
          aviso: null,
          llamadas: [{ url: "/api/fotografo/escolar/lotes/marcar", body: { ids, copias, paso: "IMPRESO" } }],
        };
      }
      const enCurso = itemsEn("PHYSICAL_IN_PROGRESS");
      if (enCurso.length > 0) {
        return {
          puede: true,
          destino: "PARA_ENTREGAR",
          explicacion: "Vas a marcarlo impreso y en la escuela.",
          aviso: null,
          llamadas: enCurso.map((i) => ({ url: `/api/fotografo/school-order-items/${i.id}/mark-at-school` })),
        };
      }
      return { puede: false, motivo: "No encontré qué marcar como impreso: hacelo desde Pedidos escolares." };
    }

    case "PARA_ENTREGAR": {
      const ids = p.disenos.filter((d) => d.printedAt && !d.deliveredAt).map((d) => d.id);
      const copias = copiasSi((c) => Boolean(c.printedAt) && !c.deliveredAt);
      if (ids.length > 0 || copias.length > 0) {
        return {
          puede: true,
          destino: "ENTREGADO",
          explicacion: `Vas a marcar entregado a la familia: ${trabajos(ids.length, copias.length)}.`,
          aviso: null,
          llamadas: [{ url: "/api/fotografo/escolar/lotes/marcar", body: { ids, copias, paso: "ENTREGADO" } }],
        };
      }
      const enEscuela = itemsEn("AT_SCHOOL");
      if (enEscuela.length > 0) {
        return {
          puede: true,
          destino: "ENTREGADO",
          explicacion: "Vas a marcarlo entregado a la familia.",
          aviso: null,
          llamadas: enEscuela.map((i) => ({ url: `/api/fotografo/school-order-items/${i.id}/mark-delivered` })),
        };
      }
      return { puede: false, motivo: "No encontré qué marcar como entregado: hacelo desde Pedidos escolares." };
    }
  }
}

/** Normaliza para buscar sin importar mayúsculas ni tildes ("ales" encuentra "Alés"). */
export function normalizarBusqueda(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** El pedido coincide si todas las palabras buscadas aparecen en alguno de sus textos. */
export function coincideBusqueda(textos: Array<string | null | undefined>, busqueda: string): boolean {
  const palabras = normalizarBusqueda(busqueda).split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return true;
  const todo = normalizarBusqueda(textos.filter(Boolean).join(" "));
  return palabras.every((w) => todo.includes(w));
}

/** A qué paso vuelve cada uno ("Para imprimir" vuelve a revisión, no a "Cambios pedidos"). */
export const PASO_ANTERIOR: Partial<Record<PasoEmbudo, PasoEmbudo>> = {
  CAMBIOS_PEDIDOS: "REVISAR_DISENO",
  PARA_IMPRIMIR: "REVISAR_DISENO",
  EN_IMPRENTA: "PARA_IMPRIMIR",
  PARA_ENTREGAR: "EN_IMPRENTA",
  ENTREGADO: "PARA_ENTREGAR",
};

const AL_VOLVER: Partial<Record<PasoEmbudo, string>> = {
  CAMBIOS_PEDIDOS: "Se retira el pedido de cambios: el diseño vuelve a esperar tu revisión.",
  PARA_IMPRIMIR: "Se des-aprueba el librito: lo revisás y lo aprobás de nuevo (se rehace el PDF).",
  EN_IMPRENTA: "Sale del lote de impresión.",
  PARA_ENTREGAR: "Se borra la marca de impreso.",
  ENTREGADO: "Se borra la marca de entregado.",
};

/**
 * Cómo se vuelve un pedido al paso anterior, con la misma acción que «Volver a …» de Pedidos
 * escolares (`/api/fotografo/escolar/volver-paso`). Se mandan todas sus piezas: el servidor mueve
 * sólo las que están en ese paso. Nunca le avisa nada a la familia.
 */
export function planDeRetroceso(p: PedidoParaAdelantar): PlanDeAdelanto {
  if (!esPasoEmbudo(p.paso)) return { puede: false, motivo: "Está fuera de la línea de producción." };
  const anterior = PASO_ANTERIOR[p.paso];
  if (!anterior) {
    return {
      puede: false,
      motivo: p.paso === "POR_CANJEAR" ? "Es el primer paso." : "Antes de este paso, el pedido dependía de la familia.",
    };
  }
  const disenos = p.disenos.map((d) => d.id);
  const copias = p.copias && p.redemptionOrderId ? [p.redemptionOrderId] : [];
  const items = (p.items ?? []).map((i) => i.id);
  // Un pedido de sólo copias no se revisa: no tiene a dónde volver desde "Para imprimir".
  if (p.paso === "PARA_IMPRIMIR" && disenos.length === 0 && items.length === 0) {
    return { puede: false, motivo: "Son copias sueltas sin librito: no hay diseño para volver a revisar." };
  }
  if (disenos.length + copias.length + items.length === 0) {
    return { puede: false, motivo: "No encontré qué volver atrás: revisalo en Pedidos escolares." };
  }
  return {
    puede: true,
    destino: anterior,
    explicacion: `${AL_VOLVER[p.paso] ?? ""} A la familia no le llega ningún aviso.`.trim(),
    aviso: null,
    llamadas: [{ url: "/api/fotografo/escolar/volver-paso", body: { desde: p.paso, disenos, copias, items } }],
  };
}
