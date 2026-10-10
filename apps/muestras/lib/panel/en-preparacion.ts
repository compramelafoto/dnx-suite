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
      "Ventas por obra y por autor, junto con las visitas y los escaneos.",
    ],
  },
};
