/**
 * "Responder a" de los correos de la cola.
 *
 * Los correos salen de info@compramelafoto.com, pero cuando el aviso es por algo del fotógrafo
 * (un pedido de cambio en el diseño, la descarga de su pedido) la familia contesta con
 * "Responder" y esa respuesta tiene que llegarle al fotógrafo, no a la casilla de la plataforma.
 *
 * La cola (`EmailQueue`) no tiene una columna para esto y el schema es compartido entre varias
 * bases: en lugar de agregar una columna, el dato viaja dentro de `templateData` con una clave
 * reservada que ninguna plantilla usa.
 */

export const CLAVE_RESPONDER_A = "__replyTo";

const FORMA_DE_CORREO = /^[^\s@<>,;"']+@[^\s@<>,;"']+\.[^\s@<>,;"']+$/;

/** Devuelve la dirección lista para usar como "responder a", o null si no sirve. */
export function normalizarResponderA(raw: string | null | undefined): string | null {
  const email = raw?.trim().toLowerCase();
  if (!email || !FORMA_DE_CORREO.test(email)) return null;
  // Responder a la propia plataforma no cambia nada: se deja el comportamiento normal.
  if (email.endsWith("@compramelafoto.com")) return null;
  return email;
}

/** Suma el "responder a" a los datos del correo (sin pisar los de la plantilla). */
export function conResponderA<T extends Record<string, unknown>>(
  templateData: T | undefined,
  replyTo: string | null | undefined
): (T & { [CLAVE_RESPONDER_A]?: string }) | undefined {
  const email = normalizarResponderA(replyTo);
  if (!email) return templateData;
  return { ...(templateData ?? ({} as T)), [CLAVE_RESPONDER_A]: email };
}

/** Lee el "responder a" guardado en los datos de un correo de la cola. */
export function responderADe(templateData: unknown): string | null {
  if (!templateData || typeof templateData !== "object" || Array.isArray(templateData)) return null;
  const valor = (templateData as Record<string, unknown>)[CLAVE_RESPONDER_A];
  return typeof valor === "string" ? normalizarResponderA(valor) : null;
}
