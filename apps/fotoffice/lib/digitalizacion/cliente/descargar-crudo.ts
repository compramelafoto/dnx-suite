// apps/fotoffice/lib/digitalizacion/cliente/descargar-crudo.ts
import { elegirArchivoDeDestino } from "./apis-navegador";

/**
 * Escribe las partes, en orden, en un archivo que elige el usuario. No pasa por Vercel ni por la
 * memoria: cada parte va del almacenamiento al disco en streaming. Herramienta de verificación.
 */
export async function descargarCrudo(urls: string[], nombre: string, alAvance: (hechas: number, total: number) => void): Promise<void> {
  const destino = await elegirArchivoDeDestino(nombre);
  try {
    for (let i = 0; i < urls.length; i++) {
      const res = await fetch(urls[i]);
      if (!res.ok || !res.body) throw new Error(`La parte ${i + 1} no se pudo leer (${res.status}).`);
      await res.body.pipeTo(destino, { preventClose: true });
      alAvance(i + 1, urls.length);
    }
    await destino.close();
  } catch (e) {
    await destino.abort();
    throw e;
  }
}
