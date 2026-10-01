/**
 * Cómo salen los correos de SubiLaFoto.
 *
 * **No usa el runtime controlado de `@repo/communications`, a propósito.** Ese runtime
 * exige `RESEND_ALLOWED_RECIPIENTS` con una lista explícita de direcciones —sin comodines
 * y sin dominios— y está pensado para el correo interno, donde se sabe de antemano quién
 * recibe. Acá el destinatario es el cliente de un fotógrafo: no se puede conocer antes.
 *
 * Es el mismo camino que ya usa CompraMeLaFoto para escribirle a sus compradores.
 *
 * Lo que sí se conserva del runtime controlado es lo importante: **nada sale hasta que
 * alguien lo enciende**, y hacen falta dos cosas distintas para encenderlo.
 */

/** El interruptor propio del producto. Tiene que decir exactamente `true`. */
const INTERRUPTOR = "SUBILAFOTO_CORREOS_EN_VIVO";

export type Compuerta = { puede: true; apiKey: string } | { puede: false; motivo: string };

/**
 * Dos llaves, no una.
 *
 * La clave de Resend sola no alcanza: alguien podría copiar las variables de otro proyecto
 * y empezar a escribirle a los clientes de un fotógrafo sin quererlo. Encender los correos
 * tiene que ser una decisión escrita.
 */
export function compuertaDeEnvio(
  env: Readonly<Record<string, string | undefined>> = process.env,
): Compuerta {
  const apiKey = env.RESEND_API_KEY?.trim();
  if (!apiKey) return { puede: false, motivo: "Falta RESEND_API_KEY." };

  // Comparación exacta: "1", "si" o "on" no alcanzan. Un descuido no enciende esto.
  if (env[INTERRUPTOR] !== "true") {
    return { puede: false, motivo: `${INTERRUPTOR} no es exactamente "true".` };
  }

  return { puede: true, apiKey };
}

/**
 * El remitente: el nombre del vendedor sobre nuestra dirección.
 *
 * La dirección tiene que ser de un dominio verificado —el nuestro—, pero el nombre que ve
 * el cliente es el de quien le vendió el servicio. Es lo máximo que permite el correo sin
 * que cada fotógrafo verifique su propio dominio.
 *
 * El nombre lo escribe el vendedor, así que se limpia: un `<` o unas comillas rompen la
 * cabecera del mensaje, y en el peor caso dejan colar otra dirección.
 */
export function remitente(nombreDelVendedor: string, direccion: string): string {
  const limpio = nombreDelVendedor
    .replace(/[<>"\\,;:@]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 70);

  return limpio ? `${limpio} <${direccion}>` : direccion;
}

/** La dirección desde la que sale todo. Un dominio verificado en Resend. */
export function direccionDeSalida(
  env: Readonly<Record<string, string | undefined>> = process.env,
): string {
  return env.SUBILAFOTO_EMAIL_FROM?.trim() || "avisos@subilafoto.com";
}
