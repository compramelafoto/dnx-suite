import type { PanelSectionKey } from "@repo/muestras";

/**
 * Lo que va a hacer cada sección del panel que todavía no está construida. Daniel quiere que
 * todas las funcionalidades estén a la vista: en vez de esconderlas, la página explica qué traen.
 */
export type TextoEnPreparacion = { titulo: string; bajada: string; puntos: string[] };

export const EN_PREPARACION: Partial<Record<PanelSectionKey, TextoEnPreparacion>> = {
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
