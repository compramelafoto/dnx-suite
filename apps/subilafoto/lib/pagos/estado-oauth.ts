import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * El parámetro `state` del OAuth de Mercado Pago, firmado.
 *
 * Mercado Pago lo devuelve tal cual al terminar. Si no estuviera firmado,
 * cualquiera podría armar un retorno que conecte **su** cuenta de Mercado Pago
 * al perfil de otro vendedor: la plata de las ventas iría a la cuenta
 * equivocada y el dueño del perfil no se enteraría hasta el cierre del mes.
 *
 * Lleva además un valor al azar para que dos estados del mismo perfil no sean
 * el mismo texto.
 */

const SEPARADOR = ".";

function firmar(cuerpo: string, secreto: string): string {
  return createHmac("sha256", secreto).update(cuerpo).digest("hex");
}

export function armarEstado(perfilId: string, secreto: string): string {
  const cuerpo = `${perfilId}${SEPARADOR}${randomBytes(9).toString("hex")}`;
  return `${cuerpo}${SEPARADOR}${firmar(cuerpo, secreto)}`;
}

/** Devuelve el id del perfil, o `null` si el estado no es de fiar. */
export function leerEstado(estado: string, secreto: string): string | null {
  if (!estado || estado.length > 512) return null;

  const partes = estado.split(SEPARADOR);
  if (partes.length !== 3) return null;

  const [perfilId, azar, firma] = partes as [string, string, string];
  if (!perfilId || !azar || !firma) return null;

  const esperada = firmar(`${perfilId}${SEPARADOR}${azar}`, secreto);
  // Comparación de tiempo constante: comparar con === filtra el secreto de a
  // un carácter por vez para quien mida los tiempos de respuesta.
  const a = Buffer.from(firma, "hex");
  const b = Buffer.from(esperada, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  return perfilId;
}
