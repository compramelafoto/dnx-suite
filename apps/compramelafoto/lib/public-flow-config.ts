/**
 * Configuración del flujo público de compramelafoto.com.
 * Los pedidos de impresión, foto carnet y polaroid desde el home se asignan a este fotógrafo.
 */
export const DEFAULT_PUBLIC_PHOTOGRAPHER_ID = 79;

/** Handler del fotógrafo público (rutas sin /l/). Pedidos van al fotógrafo 79. */
export const DEFAULT_PUBLIC_PHOTOGRAPHER_HANDLER = "dnxestudio";

/** Handler del lab por defecto en compramelafoto.com (sus pedidos van al fotógrafo 79) */
export const DEFAULT_PUBLIC_LAB_HANDLER = "dnxestudio2";
