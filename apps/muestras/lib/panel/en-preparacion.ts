import type { PanelSectionKey } from "@repo/muestras";

/**
 * Lo que va a hacer cada sección del panel que todavía no está construida. Daniel quiere que
 * todas las funcionalidades estén a la vista: en vez de esconderlas, la página explica qué traen.
 */
export type TextoEnPreparacion = { titulo: string; bajada: string; puntos: string[] };

export const EN_PREPARACION: Partial<Record<PanelSectionKey, TextoEnPreparacion>> = {
  convocatorias: {
    titulo: "Convocatorias",
    bajada: "Abrí una convocatoria y recibí las obras de los fotógrafos en un solo lugar, vivan donde vivan.",
    puntos: [
      "Bases, fechas y cantidad de obras por autor, en una página pública para difundir.",
      "Los fotógrafos envían sus obras con título, año y técnica, desde el teléfono o la computadora.",
      "Ves todo lo recibido en orden y les avisás por mail a los participantes.",
      "Con las elegidas armás la muestra y su montaje sin volver a cargar nada.",
    ],
  },
  curaduria: {
    titulo: "Curaduría",
    bajada: "La selección de las obras que van a la sala, a distancia, privada y anónima.",
    puntos: [
      "El equipo curatorial ve las obras sin el nombre del autor.",
      "Cada curador puntúa y comenta; las obras se filtran por puntaje.",
      "Rondas de selección hasta llegar a la lista final.",
      "Los nombres aparecen recién cuando la selección está cerrada.",
    ],
  },
  ventas: {
    titulo: "Ventas",
    bajada: "Vendé copias impresas y archivos digitales de las obras de tu muestra.",
    puntos: [
      "Quien recorre la sala compra desde el QR de cada ficha.",
      "Precios y medidas por muestra.",
      "Cobro con Mercado Pago, repartido entre organizador, fotógrafo y plataforma.",
      "Cada autor acepta la venta y el reparto con un clic.",
      "Seguimiento de cada impresión hasta la entrega.",
      "Ediciones limitadas y numeradas, con certificado y QR de autenticidad.",
    ],
  },
  estadisticas: {
    titulo: "Estadísticas",
    bajada: "Cuánta gente escanea los QR de la sala, mira la ficha de tu muestra y compra.",
    puntos: [
      "Escaneos de los QR de las fichas de sala, obra por obra.",
      "Visitas a la ficha de la muestra y a cada obra.",
      "Ventas por obra y por autor.",
      "Libro de visitas digital con los comentarios del público.",
    ],
  },
};

/** Lo que Montaje e impresión todavía no tiene (las fichas con QR ya están). */
export const MONTAJE_EN_PREPARACION: string[] = [
  "Marcos y remarcos con plantilla, con título y autor.",
  "Cartel con el texto curatorial y catálogo de la muestra en PDF.",
  "Plano y lista de montaje: qué obra va en cada pared, con medidas.",
];
