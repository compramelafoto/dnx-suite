/**
 * ZIP de la carpeta de impresión: uno o varios pedidos, cada uno en su carpeta
 * (Pedido/Producto/Acabado/Tamaño/archivo + MANIFEST.txt + RESUMEN_PEDIDO.pdf).
 *
 * Por qué así:
 * - Sin recomprimir (`store`): las fotos son JPG, comprimirlas otra vez no achica nada y
 *   con varios pedidos de 20 MB el tiempo de CPU hacía cortar la función a mitad de camino.
 *   El navegador guardaba lo que había llegado y la fotógrafa recibía un ZIP "corrupto".
 * - De a un archivo: cada foto se lee de R2 recién cuando la anterior ya entró al ZIP, así
 *   un lote de muchos pedidos no se carga entero en memoria.
 * - Si algo falla a mitad de camino, la descarga se corta con error en vez de terminar
 *   "bien" con un ZIP incompleto.
 */

import archiver, { type Archiver } from "archiver";
import { Readable } from "stream";
import { fileExistsInR2, readFromR2 } from "@/lib/r2-client";
import { safeFilename } from "@/lib/safe-filename";

export type PrintExportFile = {
  /** Ruta dentro del ZIP, ya con la carpeta del pedido adelante. */
  zipPath: string;
  r2Key: string;
  /** Línea del MANIFEST si el archivo entró / si no se encontró. */
  manifestLine: string;
  missingLine: string;
};

export type PrintExportPlan = {
  /** Carpeta del pedido dentro del ZIP. */
  folder: string;
  manifestHeader: string[];
  files: PrintExportFile[];
  pdfBytes: Uint8Array;
};

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

async function writePlan(archive: Archiver, plan: PrintExportPlan): Promise<void> {
  const lines = [...plan.manifestHeader];
  for (const file of plan.files) {
    let ok = false;
    try {
      if (await fileExistsInR2(file.r2Key)) {
        const buffer = await readFromR2(file.r2Key);
        await appendAndWait(archive, buffer, file.zipPath);
        ok = true;
      }
    } catch (err) {
      // Un archivo que no se puede leer no frena el resto: queda anotado en el MANIFEST.
      console.error("[print-export] no se pudo leer", file.r2Key, err);
    }
    lines.push(ok ? file.manifestLine : file.missingLine);
  }
  await appendAndWait(archive, lines.join("\n"), `${plan.folder}/MANIFEST.txt`);
  await appendAndWait(archive, Buffer.from(plan.pdfBytes), `${plan.folder}/RESUMEN_PEDIDO.pdf`);
}

export function streamPrintExportZip(
  plans: PrintExportPlan[],
  zipName: string,
  extras: Array<{ name: string; content: string }> = []
): Response {
  const archive = archiver("zip", { store: true });
  archive.on("warning", (err) => console.warn("[print-export] advertencia", err));

  void (async () => {
    try {
      for (const plan of plans) await writePlan(archive, plan);
      for (const extra of extras) await appendAndWait(archive, extra.content, extra.name);
      await archive.finalize();
    } catch (err) {
      console.error("[print-export] ZIP interrumpido", err);
      // Cortar el stream con error: el navegador marca la descarga como fallida en vez de
      // guardar un ZIP incompleto que después no abre.
      archive.destroy(err instanceof Error ? err : new Error(String(err)));
    }
  })();

  const headers = new Headers();
  headers.set("Content-Type", "application/zip");
  headers.set("Content-Disposition", `attachment; filename="${safeFilename(zipName, "pedidos")}.zip"`);
  headers.set("Cache-Control", "no-store");
  return new Response(Readable.toWeb(archive) as unknown as ReadableStream, { headers });
}
