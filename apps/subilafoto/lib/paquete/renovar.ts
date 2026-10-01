/**
 * Cuándo el cliente puede pedir enlaces de descarga nuevos.
 *
 * El panel le promete que "después pedís unos nuevos desde acá". Esto es esa promesa.
 *
 * El enlace vence a los siete días a propósito: uno eterno es una copia de las fotos de
 * una fiesta circulando para siempre por WhatsApp. Que venza sin forma de renovarlo, en
 * cambio, es dejar sin su material a alguien que pagó.
 */

/**
 * Cuántas veces se puede renovar.
 *
 * Diez son de sobra para un cliente que se olvidó de bajar el paquete unas cuantas veces.
 * El tope existe para que un enlace que se compartió de más no se convierta en un servidor
 * de archivos permanente: cada renovación es una ventana nueva de siete días.
 */
export const TOPE_DE_RENOVACIONES = 10;

export type PaqueteParaRenovar = {
  status: string;
  tokenExpiresAt: Date | null;
  regenerations: number;
};

export type EstadoDeRenovacion = { sePuede: true } | { sePuede: false; motivo: string };

export function sePuedeRenovar(entrada: {
  paquetes: readonly PaqueteParaRenovar[];
  retentionUntil: Date | null;
  ahora: Date;
}): EstadoDeRenovacion {
  // Lo primero: si el material se borró no hay nada que enlazar. Va antes que todo lo
  // demás porque ningún otro motivo se puede resolver después de esa fecha.
  if (entrada.retentionUntil && entrada.ahora.getTime() >= entrada.retentionUntil.getTime()) {
    return { sePuede: false, motivo: "El material ya se borró. Se conserva 30 días." };
  }

  const listos = entrada.paquetes.filter((p) => p.status === "READY");
  if (listos.length === 0) {
    return { sePuede: false, motivo: "Todavía estamos armando tu paquete." };
  }

  if (listos.some((p) => p.regenerations >= TOPE_DE_RENOVACIONES)) {
    return {
      sePuede: false,
      motivo: "Pediste muchos enlaces para este paquete. Escribinos y lo resolvemos.",
    };
  }

  // Alcanza con que una parte esté vencida: se renuevan todas juntas, porque un paquete
  // partido en tres con una parte que no se puede bajar no sirve de nada.
  const hayVencido = listos.some(
    (p) => !p.tokenExpiresAt || p.tokenExpiresAt.getTime() <= entrada.ahora.getTime(),
  );
  if (!hayVencido) {
    return { sePuede: false, motivo: "Tus enlaces siguen vigentes." };
  }

  return { sePuede: true };
}
