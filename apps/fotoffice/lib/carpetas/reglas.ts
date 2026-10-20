/**
 * La carpeta de un trabajo: los archivos que antes iban a un link de Google Drive (fotos para el
 * laboratorio, un VHS digitalizado, los escaneos de un rollo). Módulo PURO.
 */

/** Tope de un archivo: lo que admite una subida simple a R2. */
export const MAX_BYTES_ARCHIVO = 5 * 1024 ** 3;
export const MAX_ARCHIVOS_CARPETA = 500;
/** Cuánto dura la carpeta desde que se comparte; después se borra sola. */
export const DIAS_CARPETA = 30;

export type Audiencia = "CLIENTE" | "LABORATORIO";

/** Nombre de archivo sin rutas ni caracteres raros, conservando la extensión. */
export function limpiarNombreArchivo(nombre: string): string {
  const base = nombre.split(/[\\/]/).pop() ?? "archivo";
  const limpio = base.normalize("NFC").replace(/[\u0000-\u001f<>:"|?*]/g, "").trim().slice(0, 180);
  return limpio === "" || limpio === "." || limpio === ".." ? "archivo" : limpio;
}

/** El tipo que declara el navegador, o uno genérico si no manda nada que se entienda. */
export function tipoDeArchivo(tipo: string): string {
  return /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i.test(tipo) && tipo.length <= 100 ? tipo.toLowerCase() : "application/octet-stream";
}

export function claveDeArchivo(workspaceId: string, proyectoId: string, archivoId: string, nombre: string): string {
  const seguro = limpiarNombreArchivo(nombre).replace(/[^A-Za-z0-9._-]+/g, "_");
  return `trabajos/${workspaceId}/${proyectoId}/${archivoId}/${seguro}`;
}

/** Al compartir, la carpeta dura `DIAS_CARPETA` más; nunca se acorta. */
export function nuevoVencimiento(actual: Date | null, ahora: Date): Date {
  const propuesto = new Date(ahora.getTime() + DIAS_CARPETA * 86_400_000);
  return actual && actual > propuesto ? actual : propuesto;
}

export function esVideo(tipo: string): boolean {
  return tipo === "video/mp4" || tipo === "video/webm" || tipo === "video/quicktime";
}

export function tamanoLegible(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1).replace(".", ",")} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2).replace(".", ",")} GB`;
}
