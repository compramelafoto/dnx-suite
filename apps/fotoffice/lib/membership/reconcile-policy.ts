/**
 * A qué pagos pendientes vale la pena volver a preguntarle a MercadoPago.
 *
 * Los webhooks se pierden. Sin conciliación, un socio paga y sigue debiendo, y nadie se
 * entera hasta que reclama. Pero preguntar por todo lo pendiente cada vez tampoco sirve:
 * consume el límite de la API y castiga a los pagos recientes, que todavía pueden llegar
 * por su cuenta.
 */

/**
 * Antes de este tiempo no se pregunta: el aviso normal llega en segundos, y consultar un
 * pago de hace treinta segundos es puro ruido.
 */
export const MIN_AGE_MS = 10 * 60 * 1000;

/**
 * Después de este tiempo se deja de preguntar. El efectivo de MercadoPago vence a las 72
 * horas; un pendiente de una semana no se va a acreditar solo, y seguir consultándolo cada
 * hora para siempre es una fuga silenciosa.
 */
export const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Tope por corrida, para no agotar el límite de la API en un pico. */
export const MAX_PER_RUN = 50;

export type PendingPayment = {
  id: string;
  workspaceId: string;
  createdAt: Date;
};

/**
 * Los más viejos primero: son los que más tiempo llevan mal y los que están por caer fuera
 * de la ventana.
 */
export function selectPaymentsToReconcile(
  pendientes: PendingPayment[],
  opciones: { now: Date; maxPerRun?: number },
): PendingPayment[] {
  const tope = opciones.maxPerRun ?? MAX_PER_RUN;
  const ahora = opciones.now.getTime();

  return pendientes
    .filter((p) => {
      const edad = ahora - p.createdAt.getTime();
      return edad >= MIN_AGE_MS && edad <= MAX_AGE_MS;
    })
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .slice(0, tope);
}

/**
 * Un pendiente que ya salió de la ventana. No se lo consulta más, pero conviene saber que
 * existe: son los que hay que mirar a mano.
 */
export function findAbandoned(
  pendientes: PendingPayment[],
  opciones: { now: Date },
): PendingPayment[] {
  const ahora = opciones.now.getTime();
  return pendientes.filter((p) => ahora - p.createdAt.getTime() > MAX_AGE_MS);
}
