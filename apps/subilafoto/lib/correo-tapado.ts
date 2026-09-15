/**
 * Un correo tapado, para mostrarlo en una pantalla a la que se llega por un enlace.
 *
 * La pantalla de "gracias" se abre con el identificador de la orden en la dirección. Ese
 * identificador no es adivinable, pero tampoco es un secreto: viaja en el historial del
 * navegador, en una captura compartida y en cualquier registro que guarde direcciones.
 *
 * El que compró tiene que **reconocer** su correo ahí, no leerlo. Con las dos primeras
 * letras y el dominio alcanza para eso y no alcanza para cosecharlo.
 */
export function correoTapado(correo: string | null | undefined): string {
  const limpio = (correo ?? "").trim();
  const arroba = limpio.lastIndexOf("@");
  if (arroba < 1 || arroba === limpio.length - 1) return "***";

  const nombre = limpio.slice(0, arroba);
  const dominio = limpio.slice(arroba + 1);
  if (!dominio.includes(".")) return "***";

  // Con menos de cinco letras, tapar el medio deja ver casi todo —"juan" quedaría como
  // "ju***n", que es el nombre entero—. Ahí se tapa completo.
  if (nombre.length < 5) return `***@${dominio}`;

  return `${nombre.slice(0, 2)}***${nombre.slice(-1)}@${dominio}`;
}
