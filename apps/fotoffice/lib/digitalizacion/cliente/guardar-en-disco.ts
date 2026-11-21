// apps/fotoffice/lib/digitalizacion/cliente/guardar-en-disco.ts

/**
 * «Guardar en pendrive o disco»: copia el video final (el MP4 convertido, el mismo que le llega al
 * cliente) a un archivo que el operador ya eligió con el selector de Chrome/Edge (un pendrive, un
 * disco externo o cualquier carpeta). Va del almacenamiento al disco en streaming: no pasa por
 * Vercel ni queda entero en la memoria, así que sirve para videos de varios GB.
 *
 * El selector tiene que abrirse antes, como primera cosa del clic (ver `elegirArchivoDeDestino`).
 */
export async function guardarVideoEnDisco(
  destino: WritableStream<Uint8Array>,
  url: string,
  alAvance: (porcentaje: number | null, bytes: number) => void,
): Promise<void> {
  try {
    const res = await fetch(url);
    if (!res.ok || !res.body) throw new Error(`No se pudo leer el video (${res.status}).`);
    const total = Number(res.headers.get("content-length")) || 0;
    let bytes = 0;
    let ultimo = -1;
    const contador = new TransformStream<Uint8Array, Uint8Array>({
      transform(trozo, control) {
        bytes += trozo.byteLength;
        const pct = total > 0 ? Math.min(100, Math.floor((bytes / total) * 100)) : null;
        // Un aviso por punto porcentual (o cada ~5 MB sin tamaño conocido), no por cada trozo.
        const marca = pct ?? Math.floor(bytes / 5_000_000);
        if (marca !== ultimo) {
          ultimo = marca;
          alAvance(pct, bytes);
        }
        control.enqueue(trozo);
      },
    });
    await res.body.pipeThrough(contador).pipeTo(destino);
  } catch (e) {
    try { await destino.abort(); } catch { /* ya estaba cerrado o abortado: importa el error original */ }
    throw e;
  }
}

/** El nombre del archivo final: el de la grabación con extensión .mp4 (el crudo puede ser .webm o .vob). */
export function nombreDelVideoFinal(nombreArchivo: string): string {
  const base = nombreArchivo.replace(/\.[A-Za-z0-9]{1,5}$/, "");
  return `${base || "Video"}.mp4`;
}

export function textoAvance(porcentaje: number | null, bytes: number): string {
  if (porcentaje !== null) return `Guardando… ${porcentaje}%`;
  return `Guardando… ${(bytes / 1_000_000).toLocaleString("es-AR", { maximumFractionDigits: 0 })} MB`;
}
