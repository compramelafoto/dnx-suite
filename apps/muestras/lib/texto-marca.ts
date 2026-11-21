/** Primera letra en mayúscula ("fotógrafos" -> "Fotógrafos"). */
export function capitalizar(texto: string): string {
  return texto.charAt(0).toLocaleUpperCase("es") + texto.slice(1);
}
