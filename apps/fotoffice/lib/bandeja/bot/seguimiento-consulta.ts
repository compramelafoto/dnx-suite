/**
 * PURO. Seguimiento de las consultas de catálogo que no terminaron en compra: el cliente preguntó
 * un precio (copias, fotolibros, productos), el bot se lo pasó y el cliente no volvió a escribir.
 * Cerca del final de la ventana de 24 h (gratis, sin plantilla) el bot le escribe UNA vez para
 * retomarla. Lo corre el mismo cron que el recordatorio de pago, con el mismo horario.
 * Las cotizaciones de eventos tienen su propio seguimiento (`lib/presupuestos/seguimiento-whatsapp`).
 */

/** Comienzo del mensaje SISTEMA que deja el seguimiento en el chat (sirve para no repetirlo). */
export const MARCA_SEGUIMIENTO_CONSULTA = "Seguimiento de consulta enviado";
/** No se vuelve a hacer seguimiento al mismo chat antes de estos días. */
export const DIAS_ENTRE_SEGUIMIENTOS = 7;

/** ¿El mensaje (del bot) pasó un importe? */
export function pasoPrecio(texto: string | null | undefined): boolean {
  return Boolean(texto && /\$\s?\d/.test(texto));
}

export function textoSeguimientoConsulta(nombre: string | null): string {
  const primero = nombre?.trim().split(/\s+/)[0];
  const hola = primero ? `¡Hola ${primero}!` : "¡Hola!";
  return `${hola} 😊 ¿Pudiste ver lo que te pasé? Si querés, te lo dejo armado y te mando el enlace para pagarlo.`;
}
