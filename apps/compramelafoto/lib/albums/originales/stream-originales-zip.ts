/**
 * ZIP en streaming con los originales de una parte del álbum.
 *
 * Mismo criterio que `lib/orders/print-export/stream-print-export-zip.ts`:
 * - Sin recomprimir (`store`): son JPG, recomprimir no achica y gasta el tiempo de la función.
 * - De a una foto: la siguiente se lee de R2 recién cuando la anterior ya entró al ZIP, así
 *   la memoria no crece con el tamaño de la parte.
 * - Una foto que no se puede leer no corta la descarga: queda anotada en FALTANTES.txt.
 * - Si el ZIP en sí falla a mitad de camino, el stream se corta con error para que el navegador
 *   marque la descarga como fallida en vez de guardar un ZIP roto.
 */

import archiver, { type Archiver } from "archiver";
import { Readable } from "stream";
import { safeFilename } from "@/lib/safe-filename";

export type FotoOriginal = {
  id: number;
  /** Nombre dentro del ZIP. */
  nombre: string;
};

/** Devuelve los bytes del original; tira error si no lo encuentra. */
export type LectorDeOriginal = (fotoId: number) => Promise<Buffer>;

function appendAndWait(archive: Archiver, data: Buffer | string, name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const onEntry = (entry: { name: string }) => {
      if (entry.name !== name) return;
      cleanup();
      resolve();
    };
    const onError = (err: Error) => {
      cleanup();
      reject(err);
    };
    const cleanup = () => {
      archive.off("entry", onEntry);
      archive.off("error", onError);
    };
    archive.on("entry", onEntry);
    archive.on("error", onError);
    archive.append(data, { name });
  });
}

/** Arma el ZIP sobre un `archiver` ya creado. Separado para poder probarlo. */
export async function escribirOriginales(
  archive: Archiver,
  fotos: FotoOriginal[],
  leer: LectorDeOriginal,
): Promise<{ agregadas: number; faltantes: number[] }> {
  const faltantes: number[] = [];
  let agregadas = 0;
  for (const foto of fotos) {
    let bytes: Buffer | null = null;
    try {
      bytes = await leer(foto.id);
    } catch (err) {
      console.error("[originales] no se pudo leer la foto", foto.id, err);
    }
    if (bytes && bytes.length > 0) {
      await appendAndWait(archive, bytes, foto.nombre);
      agregadas += 1;
    } else {
      faltantes.push(foto.id);
    }
  }
  if (faltantes.length > 0) {
    const texto = [
      `No se pudieron incluir ${faltantes.length} foto(s) de esta parte.`,
      "Probá bajar esta parte de nuevo; si siguen faltando, escribinos a soporte con estos números:",
      "",
      ...faltantes.map((id) => `Foto ${id}`),
    ].join("\n");
    await appendAndWait(archive, texto, "FALTANTES.txt");
  }
  return { agregadas, faltantes };
}

export function streamOriginalesZip(
  fotos: FotoOriginal[],
  zipName: string,
  leer: LectorDeOriginal,
): Response {
  const archive = archiver("zip", { store: true });
  archive.on("warning", (err) => console.warn("[originales] advertencia", err));

  void (async () => {
    try {
      await escribirOriginales(archive, fotos, leer);
      await archive.finalize();
    } catch (err) {
      console.error("[originales] ZIP interrumpido", err);
      archive.destroy(err instanceof Error ? err : new Error(String(err)));
    }
  })();

  const headers = new Headers();
  headers.set("Content-Type", "application/zip");
  headers.set("Content-Disposition", `attachment; filename="${safeFilename(zipName, "originales")}.zip"`);
  headers.set("Cache-Control", "no-store");
  return new Response(Readable.toWeb(archive) as unknown as ReadableStream, { headers });
}
