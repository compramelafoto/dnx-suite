/** Claves de los correos automáticos de la galería (módulo PURO). */
export const CLAVES_AUTOMATICO_GALERIA = ["GALERIA_ENVIO", "GALERIA_SELECCION_ENVIADA"] as const;
export type ClaveAutomaticoGaleria = (typeof CLAVES_AUTOMATICO_GALERIA)[number];
