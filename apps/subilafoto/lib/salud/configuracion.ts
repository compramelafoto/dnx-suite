/**
 * Qué variables de entorno le faltan a producción.
 *
 * Existe porque la forma de enterarse de que falta una variable era que algo fallara: el
 * fotógrafo no puede conectar Mercado Pago, o los correos salen en seco y nadie mira la
 * tabla. Esto lo dice antes, en una línea.
 *
 * **Nunca devuelve un valor, sólo el nombre y para qué era.** Un panel que muestra
 * credenciales es peor que no tener panel.
 */

export type Requerida = { nombre: string; sinElla: string };

export const REQUERIDAS: readonly Requerida[] = [
  { nombre: "DATABASE_URL", sinElla: "No hay base de datos." },
  { nombre: "AUTH_SECRET", sinElla: "Nadie puede iniciar sesión." },
  { nombre: "R2_BUCKET", sinElla: "No se pueden guardar las fotos." },
  { nombre: "R2_ACCESS_KEY_ID", sinElla: "No se pueden guardar las fotos." },
  { nombre: "CRON_SECRET", sinElla: "Las cinco tareas automáticas devuelven 503." },
  { nombre: "AWS_ACCESS_KEY_ID", sinElla: "Ninguna foto se modera, y por eso ninguna se publica." },
  {
    nombre: "SUBILAFOTO_MP_CLIENT_ID",
    sinElla: "El fotógrafo no puede conectar su cuenta de Mercado Pago.",
  },
  {
    nombre: "SUBILAFOTO_MP_CLIENT_SECRET",
    sinElla: "El fotógrafo no puede conectar su cuenta de Mercado Pago.",
  },
  {
    nombre: "SUBILAFOTO_MP_REDIRECT_URI",
    sinElla: "La vuelta de Mercado Pago no llega a ningún lado.",
  },
  {
    nombre: "SUBILAFOTO_MP_ACCESS_TOKEN",
    sinElla: "No se leen los pagos y no se cobra el adicional de descarga.",
  },
  {
    nombre: "DNX_FINANCIAL_CREDENTIAL_MASTER_KEY",
    sinElla: "No se puede guardar el token del vendedor.",
  },
  { nombre: "RESEND_API_KEY", sinElla: "Los cinco avisos posteriores al evento salen en seco." },
];

export type EstadoDeConfiguracion = {
  completa: boolean;
  faltan: Requerida[];
  /** El interruptor de los correos. Apagado **no** es un error: es una decisión. */
  correosEnVivo: boolean;
};

export function revisarConfiguracion(
  env: Readonly<Record<string, string | undefined>> = process.env,
): EstadoDeConfiguracion {
  // Una variable en blanco cuenta como ausente: pegar una vacía en Vercel es más común
  // que olvidarla, y el efecto es el mismo.
  const faltan = REQUERIDAS.filter((r) => !env[r.nombre]?.trim());

  return {
    completa: faltan.length === 0,
    faltan,
    correosEnVivo: env.SUBILAFOTO_CORREOS_EN_VIVO === "true",
  };
}
