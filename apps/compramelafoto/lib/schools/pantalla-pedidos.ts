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
 * - Para imprimir → En imprenta: arma un lote con sus librititos aprobados; si no tiene librito
 *   pero es de la tienda escolar, marca sus ítems en imprenta.
 * - En imprenta → Para entregar: marca impresos los librititos (o los ítems "en la escuela").
 * - Para entregar → Entregado: marca entregados los librititos (o los ítems).
 */
export function planDeAdelanto(p: PedidoParaAdelantar): PlanDeAdelanto {
  const items = p.items ?? [];
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
      if (ids.length > 0) {
        return {
          puede: true,
          destino: "EN_IMPRENTA",
          explicacion: `Vas a mandar a imprimir ${plural(ids.length, "librito", "librititos")} en un lote nuevo. Después bajás el ZIP o el PDF desde Pedidos escolares.`,
          aviso: null,
          llamadas: [{ url: "/api/fotografo/escolar/lotes", body: { ids } }],
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
      return {
        puede: false,
        motivo: "Son copias sueltas sin librito: se imprimen desde el pedido, no entran en un lote.",
      };
    }

    case "EN_IMPRENTA": {
      const ids = p.disenos.filter((d) => d.sentToPrintAt && !d.printedAt).map((d) => d.id);
      if (ids.length > 0) {
        return {
          puede: true,
          destino: "PARA_ENTREGAR",
          explicacion: `Vas a marcar ${plural(ids.length, "librito impreso", "librititos impresos")}.`,
          aviso: null,
          llamadas: [{ url: "/api/fotografo/escolar/lotes/marcar", body: { ids, paso: "IMPRESO" } }],
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
      if (ids.length > 0) {
        return {
          puede: true,
          destino: "ENTREGADO",
          explicacion: `Vas a marcar ${plural(ids.length, "librito entregado", "librititos entregados")} a la familia.`,
          aviso: null,
          llamadas: [{ url: "/api/fotografo/escolar/lotes/marcar", body: { ids, paso: "ENTREGADO" } }],
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
