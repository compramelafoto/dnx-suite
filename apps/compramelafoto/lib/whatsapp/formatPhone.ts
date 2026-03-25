/**
 * Formatea teléfono para WhatsApp Cloud API.
 * Pensado para Argentina: acepta 9, 10, 11 dígitos y normaliza a formato internacional.
 *
 * Ejemplos:
 * - 11 1234-5678 -> 5491112345678
 * - 011 15 1234-5678 -> 5491112345678
 * - +54 9 11 1234-5678 -> 5491112345678
 */

export function formatPhoneForWhatsApp(phone: string): string {
  if (!phone || typeof phone !== "string") return "";

  // Quitar todo excepto dígitos
  let digits = phone.replace(/\D/g, "");

  if (digits.length === 0) return "";

  // Argentina: código país 54
  // Si empieza con 54, ya tiene código país
  if (digits.startsWith("54")) {
    // Quitar el 9 después del 54 si existe (54 9 11... -> 54 11...)
    if (digits.length > 10 && digits.charAt(2) === "9") {
      digits = "54" + digits.slice(3);
    }
    return digits;
  }

  // Si tiene 10 dígitos: asumir 11 (CABA) + 8 dígitos
  if (digits.length === 10 && digits.startsWith("11")) {
    return "54" + digits;
  }

  // Si tiene 9 dígitos: asumir 9 (móvil) + código área 11 + 7 dígitos
  if (digits.length === 9) {
    return "549" + digits;
  }

  // Si tiene 8 dígitos: asumir CABA 11 + 8 dígitos
  if (digits.length === 8) {
    return "54911" + digits;
  }

  // Si tiene 11 dígitos y empieza con 9: 9 + 10 dígitos (código área + número)
  if (digits.length === 11 && digits.startsWith("9")) {
    return "54" + digits;
  }

  // Default: agregar 54 si no lo tiene
  if (!digits.startsWith("54") && digits.length >= 9) {
    return "54" + digits;
  }

  return digits;
}
