/**
 * Mensaje de WhatsApp con el link de canje de una familia. Lo usan el script que crea los
 * combos y el panel "Canjes" del álbum, así la familia recibe siempre el mismo texto.
 */

/** Celular de Argentina para wa.me: 54 9 + área + número, sin el 15 ni el 0. */
export function telefonoWhatsAppArgentina(phone: string): string | null {
  const digits = phone.replace(/\D/g, "").replace(/^549/, "").replace(/^54/, "").replace(/^0/, "");
  return digits.length === 10 ? `549${digits}` : null;
}

/**
 * El link canjea lo que pagó esa familia, una sola vez: si lo reenvía al grupo del curso,
 * otro puede usarlo antes.
 */
export const AVISO_LINK_UNICO = "Este link es único para tu familia: por favor no lo compartas.";

export function buildCanjeWhatsAppMessage(input: {
  parentName: string | null;
  studentName: string | null;
  albumTitle: string;
  comboLabel: string;
  printUnits: number;
  link: string;
}): string {
  const saludo = input.parentName?.trim() ? `¡Hola ${input.parentName.trim()}!` : "¡Hola!";
  const alumno = input.studentName?.trim().split(/\s+/)[0];
  const fotos = input.printUnits === 1 ? "la foto" : `las ${input.printUnits} fotos`;
  return (
    `${saludo} Te paso el link para elegir las fotos${alumno ? ` de ${alumno}` : ""} ` +
    `de "${input.albumTitle}".\n\n` +
    `El combo de ${input.comboLabel} ya está pago. Entrá al link y elegí ${fotos} del combo. ` +
    `Después, si querés, podés sumar más fotos (esas se pagan aparte).\n\n${AVISO_LINK_UNICO}\n\n${input.link}`
  );
}

/** Mensaje para un pack de preventa cobrado por fuera (librito, copias, digitales). */
export function buildPreventaCanjeWhatsAppMessage(input: {
  parentName: string | null;
  studentName: string | null;
  albumTitle: string;
  packLabel: string;
  link: string;
}): string {
  const saludo = input.parentName?.trim() ? `¡Hola ${input.parentName.trim()}!` : "¡Hola!";
  // Nombres completos: las listas de colegio vienen "APELLIDO Nombre" y el primer token sería el apellido.
  const alumno = input.studentName?.trim();
  return (
    `${saludo} Ya están las fotos de "${input.albumTitle}".\n\n` +
    `Lo que compraste${alumno ? ` para ${alumno}` : ""} (${input.packLabel}) ya está pago. ` +
    `Entrá al link y elegí las fotos que van en tu pedido. ` +
    `Si querés, después podés sumar más fotos (esas se pagan aparte).\n\n${AVISO_LINK_UNICO}\n\n${input.link}`
  );
}

export function buildWhatsAppUrl(phone: string, message: string): string | null {
  const tel = telefonoWhatsAppArgentina(phone);
  return tel ? `https://wa.me/${tel}?text=${encodeURIComponent(message)}` : null;
}
