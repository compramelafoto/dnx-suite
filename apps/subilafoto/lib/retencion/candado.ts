/**
 * Cuándo se borra el material de un evento, y qué lo frena.
 *
 * La regla comercial es simple: **todo se borra a los 30 días del cierre**, sin
 * excepciones. Lo que el cliente ya descargó es suyo; lo que se borra es lo que queda en
 * la plataforma.
 *
 * Lo que no es simple es el borde. Un borrado no se deshace, así que antes de tocar nada
 * hay que descartar que quede plata o una entrega en el aire. Ese es el candado.
 *
 * Función pura: son todas reglas de fecha y de conteo, y se rompen en los bordes.
 */

/** Días desde el cierre hasta que se borra. */
export const DIAS_DE_RETENCION = 30;

/**
 * Cuántas horas después de creada una orden pendiente se la sigue considerando viva.
 *
 * Mercado Pago aprueba una tarjeta en segundos, pero un pago en efectivo por Rapipago o
 * Pago Fácil puede tardar hasta tres días hábiles en acreditarse. Borrar el evento
 * mientras ese pago viaja sería cobrarle a alguien por algo que ya no existe.
 *
 * Pasadas las 72 horas la orden pendiente es un carrito abandonado, no un pago.
 */
export const HORAS_DE_PAGO_EN_CURSO = 72;

const UN_DIA = 24 * 60 * 60 * 1000;

export type MotivoDelCandado =
  | "ya-borrado"
  | "sin-plazo"
  | "no-vencio"
  | "disputa-abierta"
  | "entrega-pendiente"
  | "pago-en-curso"
  | "paquete-en-curso";

export type EstadoParaBorrar = {
  retentionUntil: Date | null;
  purgedAt: Date | null;
  ahora: Date;
  /** Órdenes en `PENDING` creadas dentro de la ventana de pago en curso. */
  pagosEnCurso: number;
  /** Órdenes en `DISPUTED`: hay un reclamo sin resolver. */
  disputas: number;
  /** Órdenes pagadas con descarga cuyo paquete nunca llegó a estar listo. */
  entregasPendientes: number;
  /** Paquetes en `QUEUED` o `BUILDING`. */
  paquetesEnCurso: number;
};

/** Hasta cuándo se guarda el material de un evento que cerró en `cierre`. */
export function retencionHasta(cierre: Date): Date {
  return new Date(cierre.getTime() + DIAS_DE_RETENCION * UN_DIA);
}

/** A partir de qué momento una orden pendiente todavía cuenta como pago en curso. */
export function desdeCuandoUnPagoSigueEnCurso(ahora: Date): Date {
  return new Date(ahora.getTime() - HORAS_DE_PAGO_EN_CURSO * 60 * 60 * 1000);
}

/**
 * Por qué **no** hay que borrar este evento, o `null` si se puede.
 *
 * El orden importa: se devuelve un motivo solo, y tiene que ser el más grave de los que
 * aplican, porque es el que queda anotado en la auditoría y el que alguien va a leer
 * cuando pregunte por qué un evento sigue ocupando lugar.
 */
export function motivoParaNoBorrar(estado: EstadoParaBorrar): MotivoDelCandado | null {
  if (estado.purgedAt) return "ya-borrado";

  // Sin plazo no hay vencimiento que calcular. Un evento que nunca cerró no se borra por
  // las dudas: es preferible que quede ocupando lugar a borrar algo que sigue vivo.
  if (!estado.retentionUntil) return "sin-plazo";

  if (estado.ahora.getTime() < estado.retentionUntil.getTime()) return "no-vencio";

  // Una disputa es plata que puede volver: mientras esté abierta, el material es la
  // prueba de qué se entregó.
  if (estado.disputas > 0) return "disputa-abierta";

  // Alguien pagó la descarga y nunca la recibió. Borrar acá es quedarse con el dinero y
  // destruir lo comprado en el mismo movimiento. Frena para siempre, a propósito: que un
  // evento quede ocupando lugar se arregla; esto no.
  if (estado.entregasPendientes > 0) return "entrega-pendiente";

  if (estado.pagosEnCurso > 0) return "pago-en-curso";

  // Borrar las fotos mientras el ZIP las está leyendo deja un paquete corrupto que igual
  // se entrega.
  if (estado.paquetesEnCurso > 0) return "paquete-en-curso";

  return null;
}
