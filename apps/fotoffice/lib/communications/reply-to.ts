/**
 * A quién le contesta el socio.
 *
 * FotoOffice manda desde su propio dominio —es el único verificado ante el proveedor— pero
 * el mensaje lo escribe la institución. Sin esta cabecera, "Responder" va a una casilla que
 * nadie lee, y el socio que contesta "no puedo pagar este mes" habla con la pared.
 *
 * Es una cabecera del email, no un dato de la firma: por eso no sale de
 * `toEmailSignatureData`, que arma lo que se VE al pie, sino de acá.
 *
 * Función pura: decide el texto de la cabecera y nada más. Quien envía la pone o la ignora.
 */

/**
 * Caracteres que en una cabecera significan otra cosa. Un salto de línea es el más grave:
 * permitiría inyectar cabeceras nuevas desde un campo que carga la Secretaría a mano.
 */
const PELIGROSOS = /[\r\n\0]/;

/** Lo que obliga a entrecomillar el nombre para mostrar, según RFC 5322. */
const NECESITA_COMILLAS = /[(),.:;<>@[\]\\"]/;

function limpio(value: string | null | undefined): string | null {
  const t = value?.trim();
  if (!t || PELIGROSOS.test(t)) return null;
  return t;
}

/**
 * Validación deliberadamente laxa: acá no se decide si la dirección existe —eso lo dice el
 * rebote— sino si es segura de poner en una cabecera. Una dirección con espacios o sin
 * arroba es un error de carga, y mandarla haría que el proveedor rechace el email entero.
 */
function direccionUsable(value: string): boolean {
  if (/\s/.test(value)) return false;
  const partes = value.split("@");
  return partes.length === 2 && partes[0].length > 0 && partes[1].includes(".");
}

export function institutionReplyTo(input: {
  organizationName: string | null;
  contactEmail: string | null;
}): string | null {
  const email = limpio(input.contactEmail);
  if (!email || !direccionUsable(email)) return null;

  const nombre = limpio(input.organizationName);
  if (!nombre) return email;

  // El nombre lo escribe una persona en el panel: puede traer una coma, un punto o
  // comillas, y cualquiera de esos parte la cabecera en dos si va suelto.
  const mostrado = NECESITA_COMILLAS.test(nombre)
    ? `"${nombre.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
    : nombre;
  return `${mostrado} <${email}>`;
}
