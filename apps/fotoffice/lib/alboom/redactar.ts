/**
 * Lo que Alboom devuelve puede traer secretos de terceros: la clave API del suscriptor (`Subscriber.api_key`), la
 * de Mailchimp (`mailchimp_api_key`), datos de la tarjeta de la suscripción, usuario y contraseña SMTP de cada
 * usuario, tokens de Boleto o PayPal. La migración no los necesita y no se guardan: ANTES de calcular la huella y
 * de guardar, toda clave cuyo nombre coincida con `CLAVE_SECRETA` (en cualquier nivel, también dentro de arreglos)
 * queda con el valor `"[oculto]"`. Se aplica a TODAS las entidades.
 *
 * También saca el carácter nulo (`\u0000`) de los textos: JSONB de Postgres lo rechaza y trabaría la extracción.
 */
export const CLAVE_SECRETA = /pass(word)?|secret|token|api_?key|card|cvv|smtp_pass/i;
export const OCULTO = "[oculto]";

export function redactarSecretos(valor: unknown): unknown {
  if (typeof valor === "string") return valor.includes("\u0000") ? valor.replace(/\u0000/g, "") : valor;
  if (Array.isArray(valor)) return valor.map(redactarSecretos);
  if (valor === null || typeof valor !== "object") return valor;
  const salida: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
    const clave = k.replace(/\u0000/g, "");
    salida[clave] = CLAVE_SECRETA.test(clave) && v !== null && v !== "" ? OCULTO : redactarSecretos(v);
  }
  return salida;
}
