/**
 * Mensaje de WhatsApp con el link de canje de una familia. Lo usan el script que crea los
 * combos y el panel "Canjes" del álbum, así la familia recibe siempre el mismo texto.
 */

/** Celular de Argentina para wa.me: 54 9 + área + número, sin el 15 ni el 0. */
export function telefonoWhatsAppArgentina(phone: string): string | null {
  const digits = phone.replace(/\D/g, "").replace(/^549/, "").replace(/^54/, "").replace(/^0/, "");
  return digits.length === 10 ? `549${digits}` : null;
}

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
    `Después, si querés, podés sumar más fotos (esas se pagan aparte).\n\n${input.link}`
  );
}

export function buildWhatsAppUrl(phone: string, message: string): string | null {
  const tel = telefonoWhatsAppArgentina(phone);
  return tel ? `https://wa.me/${tel}?text=${encodeURIComponent(message)}` : null;
}
