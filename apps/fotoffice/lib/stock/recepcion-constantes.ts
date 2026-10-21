/** Estados de una recepción de pedido. Texto en la base, con CHECK en SQL. */
export const ESTADOS_RECEPCION = ["BORRADOR", "CONFIRMADA", "DESCARTADA"] as const;
export type EstadoRecepcion = (typeof ESTADOS_RECEPCION)[number];

/** De dónde salió cada línea: lector de códigos, carga a mano o importación del comprobante. */
export const ORIGENES_LINEA = ["LECTOR", "MANUAL", "IMPORTACION"] as const;
export type OrigenLinea = (typeof ORIGENES_LINEA)[number];

/** `sourceModule` de los movimientos de stock que genera confirmar una recepción. */
export const SOURCE_MODULE_RECEPCION = "stock-recepcion";
