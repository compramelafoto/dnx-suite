/**
 * Parseo seguro de respuestas del upload de logos.
 * Evita "Unexpected end of JSON input" cuando Vercel/proxy devuelve body vacío
 * (p. ej. payload > ~4.5 MB).
 */
export async function parseLogoUploadResponse<T extends Record<string, unknown>>(
  res: Response,
): Promise<T> {
  const text = await res.text();
  if (!text.trim()) {
    if (res.status === 413) {
      throw new Error("El archivo es demasiado grande. Usá un PNG/WEBP de hasta 4 MB.");
    }
    if (res.status >= 500 || res.status === 0) {
      throw new Error(
        "No se pudo subir el logo (respuesta vacía del servidor). Probá con un PNG/WEBP más liviano (máx. 4 MB).",
      );
    }
    throw new Error(
      "No se pudo subir el logo (respuesta vacía). Probá de nuevo o con un archivo más liviano (máx. 4 MB).",
    );
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Respuesta inválida del servidor (${res.status || "sin estado"}).`);
  }
}
