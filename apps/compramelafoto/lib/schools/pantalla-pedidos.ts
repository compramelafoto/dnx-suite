/**
 * "Pantalla de pedidos": los pedidos escolares para mostrar en un televisor o compartir en una
 * videollamada. Arriba, un contador grande por paso; abajo, las tarjetas de los pedidos, que van
 * pasando de a páginas cuando no entran todas.
 *
 * Es puro (sin base, red ni navegador): la pantalla le pasa los pedidos y el tamaño de la grilla.
 *
 * La esquina de abajo a la derecha queda libre: ahí el que presenta suele poner su cámara. Las
 * celdas de la grilla que caen en esa esquina se dejan vacías.
 */

import {
  INFO_PASOS,
  PASOS_EMBUDO,
  contarPorPaso,
  esPasoEmbudo,
  type PasoEmbudo,
  type UbicacionEnEmbudo,
} from "./embudo-pedidos-escolares";

/** Cada cuánto pasa a la página siguiente de tarjetas. */
export const SEGUNDOS_POR_PAGINA = 8;
/** Cada cuánto vuelve a pedir los pedidos. */
export const SEGUNDOS_ENTRE_ACTUALIZACIONES = 15;
/** Lugar que se deja libre abajo a la derecha para la cámara del que presenta. */
export const RESERVA_CAMARA = { ancho: 280, alto: 180 } as const;

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

export type MedidasGrilla = {
  /** Espacio disponible para la grilla, en píxeles. */
  ancho: number;
  alto: number;
  /** Tamaño mínimo de una tarjeta y separación entre tarjetas. */
  anchoTarjeta: number;
  altoTarjeta: number;
  separacion: number;
  /** Rincón de abajo a la derecha que tiene que quedar vacío. */
  reserva?: { ancho: number; alto: number };
};

export type Grilla = {
  columnas: number;
  filas: number;
  /** Índices de las celdas (fila por fila) que caen en el rincón reservado. */
  reservadas: number[];
  /** Cuántas tarjetas entran por página. */
  porPagina: number;
};

/**
 * Cuántas columnas y filas de tarjetas entran, y qué celdas se dejan vacías por el rincón de la
 * cámara. Las tarjetas se estiran para llenar el ancho y el alto, así que una celda está en el
 * rincón si su borde derecho y su borde de abajo entran en él. Siempre queda al menos una celda
 * útil, aunque la pantalla sea muy chica.
 */
export function calcularGrilla(m: MedidasGrilla): Grilla {
  const columnas = Math.max(1, Math.floor((m.ancho + m.separacion) / (m.anchoTarjeta + m.separacion)));
  const filas = Math.max(1, Math.floor((m.alto + m.separacion) / (m.altoTarjeta + m.separacion)));
  const anchoCelda = (m.ancho - m.separacion * (columnas - 1)) / columnas;
  const altoCelda = (m.alto - m.separacion * (filas - 1)) / filas;
  const reserva = m.reserva ?? { ancho: 0, alto: 0 };

  const reservadas: number[] = [];
  if (reserva.ancho > 0 && reserva.alto > 0) {
    for (let f = 0; f < filas; f++) {
      for (let c = 0; c < columnas; c++) {
        const derecha = c * (anchoCelda + m.separacion) + anchoCelda;
        const abajo = f * (altoCelda + m.separacion) + altoCelda;
        if (derecha > m.ancho - reserva.ancho && abajo > m.alto - reserva.alto) {
          reservadas.push(f * columnas + c);
        }
      }
    }
  }
  // Si el rincón se come toda la grilla, se deja libre la primera celda.
  if (reservadas.length >= columnas * filas) reservadas.shift();

  return { columnas, filas, reservadas, porPagina: columnas * filas - reservadas.length };
}

/** Parte la lista en páginas de `porPagina` (siempre hay al menos una página, aunque vacía). */
export function paginar<T>(items: T[], porPagina: number): T[][] {
  const tam = Math.max(1, Math.floor(porPagina));
  if (items.length === 0) return [[]];
  const paginas: T[][] = [];
  for (let i = 0; i < items.length; i += tam) paginas.push(items.slice(i, i + tam));
  return paginas;
}

/** Qué página mostrar en la vuelta número `vuelta` (se repite: 0, 1, 2, 0, 1…). */
export function paginaDeLaVuelta(vuelta: number, totalPaginas: number): number {
  if (totalPaginas <= 1) return 0;
  const v = Math.max(0, Math.floor(vuelta));
  return v % totalPaginas;
}

export type Celda<T> = { tipo: "pedido"; pedido: T } | { tipo: "vacia" } | { tipo: "reservada" };

/**
 * Pone las tarjetas de una página en las celdas de la grilla, saltando las del rincón reservado.
 * Devuelve todas las celdas (fila por fila) para que la grilla mantenga su forma.
 */
export function ubicarEnCeldas<T>(pagina: T[], grilla: Grilla): Celda<T>[] {
  const reservadas = new Set(grilla.reservadas);
  const celdas: Celda<T>[] = [];
  let siguiente = 0;
  for (let i = 0; i < grilla.columnas * grilla.filas; i++) {
    if (reservadas.has(i)) celdas.push({ tipo: "reservada" });
    else if (siguiente < pagina.length) celdas.push({ tipo: "pedido", pedido: pagina[siguiente++] });
    else celdas.push({ tipo: "vacia" });
  }
  return celdas;
}
