/**
 * Normaliza un celular argentino a la forma canónica `54` + 10 dígitos (área + número, sin 0, sin 15, sin 9).
 * Es la misma forma a la que se reduce lo que manda WhatsApp (`5493415551234` -> `543415551234`),
 * así se pueden comparar ambos lados.
 *
 * Ejemplos (todos dan 543415551234):
 * - 341 555-1234, 03415551234, 0341 15 555-1234, +54 9 341 5551234, 5493415551234
 * - 011 15 1234-5678 -> 541112345678
 *
 * Devuelve "" si no se puede reducir a un número argentino de 10 dígitos.
 */
export function normalizarTelefono(phone: string): string {
  if (!phone || typeof phone !== "string") return "";
  let d = phone.replace(/\D/g, "");
  if (d.length === 0) return "";

  if (d.startsWith("54")) {
    d = d.slice(2);
    // Móvil internacional: 54 9 <10 dígitos>.
    if (d.length === 11 && d.startsWith("9")) d = d.slice(1);
  }
  // Prefijo troncal 0 (03415551234, 011 ...).
  if (d.startsWith("0")) d = d.slice(1);

  // Prefijo móvil 15 después del código de área (2 a 4 dígitos): área + 15 + número = 12 dígitos.
  if (d.length === 12) {
    for (const area of [2, 3, 4]) {
      if (d.slice(area, area + 2) === "15") {
        d = d.slice(0, area) + d.slice(area + 2);
        break;
      }
    }
  }

  if (d.length !== 10 || d.startsWith("0")) return "";
  return "54" + d;
}
