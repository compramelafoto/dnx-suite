// apps/fotoffice/lib/digitalizacion/cliente/descargar-crudo.ts

/**
 * Escribe las partes, en orden, en un archivo que el usuario ya eligió (el selector de archivos
 * tiene que abrirse primero, dentro del clic: ver `elegirArchivoDeDestino`). No pasa por Vercel
 * ni por la memoria: cada parte va del almacenamiento al disco en streaming. Herramienta de
 * verificación.
 */
export async function descargarCrudo(
  destino: WritableStream,
  urls: string[],
  alAvance: (hechas: number, total: number) => void,
): Promise<void> {
  try {
    for (let i = 0; i < urls.length; i++) {
      const res = await fetch(urls[i]);
      if (!res.ok || !res.body) throw new Error(`La parte ${i + 1} no se pudo leer (${res.status}).`);
      await res.body.pipeTo(destino, { preventClose: true });
      alAvance(i + 1, urls.length);
    }
    await destino.close();
  } catch (e) {
    try { await destino.abort(); } catch { /* ya estaba cerrado o abortado: importa el error original */ }
    throw e;
  }
}
