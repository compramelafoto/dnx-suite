/**
 * Nombre y tipo de un archivo subido, saneados. Módulo PURO.
 *
 * Los dos los manda el navegador, así que se tratan como sospechosos: sólo se usan para firmar la
 * subida y para que la descarga lleve un nombre reconocible.
 */

/** Sin rutas, sin caracteres de control, sin comillas, y con un largo razonable. */
export function safeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const limpio = base
    .replace(/[\u0000-\u001f\u007f"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (limpio === "" || limpio === "." || limpio === "..") return "archivo";
  if (limpio.length <= 150) return limpio;
  const punto = limpio.lastIndexOf(".");
  const ext = punto > 0 && limpio.length - punto <= 10 ? limpio.slice(punto) : "";
  return limpio.slice(0, 150 - ext.length) + ext;
}

/** Un tipo MIME bien formado, o el genérico. Nunca texto libre dentro de la firma. */
export function safeContentType(type: string): string {
  const t = type.trim().toLowerCase();
  return /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/.test(t) && t.length <= 100
    ? t
    : "application/octet-stream";
}
