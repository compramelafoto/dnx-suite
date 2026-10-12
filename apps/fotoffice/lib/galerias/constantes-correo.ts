/** Claves de los correos automáticos de la galería (módulo PURO). */
export const CLAVES_AUTOMATICO_GALERIA = ["GALERIA_ENVIO", "GALERIA_SELECCION_ENVIADA", "GALERIA_COMPRA_PAGADA", "GALERIA_ENTREGA_ENVIO", "GALERIA_DESCARGA_LISTA"] as const;
export type ClaveAutomaticoGaleria = (typeof CLAVES_AUTOMATICO_GALERIA)[number];
