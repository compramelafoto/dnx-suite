/**
 * Qué archivos de R2 hay que borrar cuando vence la retención de un evento.
 *
 * Está separado del borrado en sí porque acá vive el error caro: una clave de más borra
 * algo de otro evento, una de menos deja pagando espacio para siempre. Es puro y se
 * prueba solo.
 */

/** Cuántas claves entran en un pedido de borrado. Es el tope de la API de S3. */
export const LIMITE_POR_LOTE = 1000;

/**
 * Todas las claves del evento, sin repetir y sin vacías.
 *
 * Se repiten más de lo que parece: una variante puede apuntar al original cuando la foto
 * ya venía en el tamaño justo, y pedir dos veces el borrado de la misma clave hace que S3
 * devuelva un error por la segunda.
 */
export function clavesABorrar(entrada: {
  originales: readonly (string | null | undefined)[];
  variantes: readonly (string | null | undefined)[];
  paquetes: readonly (string | null | undefined)[];
}): string[] {
  const vistas = new Set<string>();
  const salida: string[] = [];

  for (const clave of [...entrada.originales, ...entrada.variantes, ...entrada.paquetes]) {
    const limpia = clave?.trim();
    if (!limpia || vistas.has(limpia)) continue;
    vistas.add(limpia);
    salida.push(limpia);
  }

  return salida;
}

/** Parte una lista en tandas de `tamano` como mucho. */
export function enLotes<T>(items: readonly T[], tamano: number): T[][] {
  const lotes: T[][] = [];
  for (let i = 0; i < items.length; i += tamano) lotes.push(items.slice(i, i + tamano));
  return lotes;
}
