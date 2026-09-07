/**
 * Los plazos de una solicitud aprobada e impaga.
 *
 * Al aprobar, la solicitud queda con fecha de vencimiento: la persona tiene un mes para pagar
 * su ingreso. Hasta ahora esa fecha se guardaba y no la leía nadie, así que el plazo no
 * existía — una solicitud aprobada e impaga quedaba abierta para siempre.
 *
 * Funciones PURAS: no leen la base ni el reloj más que por parámetro. Los plazos son la clase
 * de regla que se prueba entera o se descubre rota el día que vence la primera solicitud real.
 */

/** Cuántos días antes del vencimiento se le recuerda a la persona que todavía no pagó. */
export const APPLICATION_REMINDER_DAYS = 7;

const DIA_MS = 24 * 60 * 60 * 1000;

export type DeadlineStage =
  /** Todavía hay plazo y no toca decir nada. */
  | "VIGENTE"
  /** Entra en la última semana: se le recuerda. */
  | "RECORDAR"
  /** Se cumplió el plazo sin pago. */
  | "VENCIDA";

/**
 * En qué punto del plazo está la solicitud.
 *
 * El recordatorio vive en una **ventana de 24 horas** en vez de en un "faltan siete días o
 * menos". La diferencia importa: la tarea corre una vez por día, y con un umbral abierto la
 * persona recibiría el mismo aviso los siete días seguidos. La ventana lo manda una sola vez
 * sin necesidad de guardar en ninguna columna que ya salió.
 *
 * El precio de esa decisión es que un día en que la tarea no corra pierde ese recordatorio.
 * Se acepta: el vencimiento —que es lo que tiene consecuencias— no depende de ninguna ventana
 * y se sigue detectando cualquier día posterior.
 */
export function applicationDeadlineStage(input: {
  expiresAt: Date | null;
  now: Date;
}): DeadlineStage {
  if (!input.expiresAt) return "VIGENTE";

  const restante = input.expiresAt.getTime() - input.now.getTime();
  // Cero cuenta como vencida: el plazo era "hasta esta fecha", no "hasta después de ella".
  if (restante <= 0) return "VENCIDA";

  const techo = APPLICATION_REMINDER_DAYS * DIA_MS;
  const piso = techo - DIA_MS;
  if (restante > piso && restante <= techo) return "RECORDAR";

  return "VIGENTE";
}

/**
 * Días que faltan, para decírselos a una persona.
 *
 * Redondea hacia arriba: a quien le quedan 36 horas se le dice "dos días", no "uno". Nunca
 * devuelve negativos — un plazo cumplido son cero días, y de eso habla otro email.
 */
export function daysUntil(target: Date, now: Date): number {
  const restante = target.getTime() - now.getTime();
  if (restante <= 0) return 0;
  return Math.ceil(restante / DIA_MS);
}
