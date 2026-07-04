/**
 * Sanitiza nombres para rutas ZIP, nombres de archivo y headers Content-Disposition.
 * El formato ZIP y muchos sistemas de archivos requieren ASCII; caracteres Unicode
 * (ej. comillas tipográficas 8217, acentos) provocan errores como
 * "Cannot convert argument to a ByteString".
 *
 * Usar en todos los archivos generados/exportados en la plataforma.
 */
export function safeFilename(name: string, fallback = "archivo"): string {
  if (!name || typeof name !== "string") return fallback;
  return (
    name
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "") // á→a, ñ→n, etc.
      .replace(/[\u2018\u2019\u201A\u201B\u201C\u201D\u201E\u201F]/g, "'") // comillas tipográficas → '
      .replace(/[\u2010-\u2015\u2212]/g, "-") // guiones Unicode → -
      .replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, " ") // espacios Unicode → espacio
      .replace(/[\/\\?%*:|"<>]/g, "-")
      .replace(/\s+/g, " ")
      .replace(/[^\x00-\x7F]/g, "-") // cualquier otro no-ASCII → -
      .trim()
      .slice(0, 200) || fallback
  );
}
