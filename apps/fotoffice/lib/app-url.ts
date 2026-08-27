/**
 * Dirección pública de la aplicación, sin barra final.
 *
 * Devuelve cadena vacía si no está configurada, y quien la usa decide qué hacer: para un
 * enlace de pago eso es un error que corta la operación; para un bloque de "compartí este
 * formulario" alcanza con no ofrecerlo. Inventar un dominio sería peor que ambas.
 */
export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "").replace(/\/+$/, "");
}
