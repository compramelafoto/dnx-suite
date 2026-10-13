/**
 * Lo que escribió el cliente, antes de mandarlo al modelo (spec §9). PURO. Se tapan correos,
 * teléfonos (7 dígitos o más, con o sin separadores), enlaces y documentos (DNI/CUIT con
 * puntos o guiones), y se recorta a 1.500 caracteres. Lo que queda es dato, nunca orden: eso
 * lo dice la guía.
 */
export const MAX_MENSAJE_CLIENTE = 1500;

const CORREO = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const ENLACE = /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:com|net|org|ar|io|me)(?:\.[a-z]{2})?(?:\/\S*)?/gi;
// CUIT/CUIL (xx-xxxxxxxx-x) y DNI con puntos (xx.xxx.xxx).
const DOCUMENTO = /\b\d{2}-?\d{8}-?\d\b|\b\d{1,2}\.\d{3}\.\d{3}\b/g;
// 7+ dígitos con espacios, guiones, puntos o paréntesis en el medio, con + opcional.
const TELEFONO = /\+?\(?\d(?:[\s().-]*\d){6,}/g;

export function redactarMensajeDelCliente(texto: string | null | undefined): string {
  if (!texto || !texto.trim()) return "";
  const limpio = texto
    .replace(CORREO, "[correo]")
    .replace(ENLACE, "[enlace]")
    .replace(DOCUMENTO, "[documento]")
    .replace(TELEFONO, "[teléfono]")
    .trim();
  return limpio.length > MAX_MENSAJE_CLIENTE ? `${limpio.slice(0, MAX_MENSAJE_CLIENTE)}…` : limpio;
}
