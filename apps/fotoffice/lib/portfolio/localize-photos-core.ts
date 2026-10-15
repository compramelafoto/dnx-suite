/**
 * Las cuentas y los nombres del realojado, sin base de datos ni red.
 *
 * Está aparte de `localize-photos.ts` para poder probar la aritmética sin levantar Postgres ni R2,
 * igual que el localizador del blog. Lo que se prueba acá no es decorativo: la cuenta de pendientes
 * es la que decide si el botón para de dar vueltas o no.
 */

/** Marca que dejó la migración del sitio viejo en `r2Key` cuando la foto no se copió todavía. */
export const MARCA_EXTERNA = "externo:";

/** Una foto del portfolio que todavía vive en el servidor de otro. */
export function esFotoExterna(r2Key: string): boolean {
  return r2Key.startsWith(MARCA_EXTERNA);
}

/** La dirección de origen guardada detrás de la marca, o `null` si la key no es externa. */
export function direccionDeOrigen(r2Key: string): string | null {
  if (!esFotoExterna(r2Key)) return null;
  const url = r2Key.slice(MARCA_EXTERNA.length).trim();
  return url === "" ? null : url;
}

/**
 * El nombre de archivo que le vamos a poner a la copia.
 *
 * Sólo sirve para quedarse con la extensión y para que la key sea legible; la parte única la pone
 * `generateFotofficeR2Key`. Si la dirección no tiene nombre usable, devuelve uno cualquiera: dejar
 * la copia sin extensión sería peor.
 */
export function nombreDeArchivo(url: string): string {
  let ruta = url;
  try {
    ruta = new URL(url).pathname;
  } catch {
    // Una dirección guardada mal no debería frenar el realojado: seguimos con el texto crudo.
  }
  const ultimo = ruta.split("/").filter(Boolean).pop() ?? "";
  let nombre = ultimo;
  try {
    nombre = decodeURIComponent(ultimo);
  } catch {
    // Un `%` suelto en el nombre tampoco frena nada.
  }
  nombre = nombre.replace(/[^\w.\-]/g, "-").replace(/-+/g, "-").slice(0, 80);
  return /\.[a-zA-Z0-9]{2,5}$/.test(nombre) ? nombre : "foto.jpg";
}

/**
 * Cuántas quedan para la próxima tanda.
 *
 * **Las que fallaron NO cuentan como pendientes.** Si contaran, quien repite tandas giraría para
 * siempre sobre las mismas fotos roídas: la tanda siguiente las volvería a intentar, volverían a
 * fallar, y el número nunca bajaría a cero. Se informan aparte, con su motivo, para que alguien
 * las mire.
 */
export function pendientesRestantes(
  totalAntes: number,
  traidas: number,
  fallidas: number,
): number {
  return Math.max(totalAntes - traidas - fallidas, 0);
}
