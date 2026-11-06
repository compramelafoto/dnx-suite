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
import { ajustarRuta } from "./rutas-cortas";

export type PrintExportFile = {
  /** Ruta dentro del ZIP, ya con la carpeta del pedido adelante. */
  zipPath: string;
  r2Key: string;
  /** Línea del MANIFEST si el archivo entró / si no se encontró. */
  manifestLine: string;
  missingLine: string;
  /** Ajuste del archivo antes de entrar al ZIP (p. ej. la marca de 300 dpi de un JPG). */
  transform?: (bytes: Buffer) => Buffer | Uint8Array;
  /** Sólo en copias sueltas: con qué se agrupan en el ZIP ordenado por tamaño. */
  impresion?: { producto: string; acabado: string; tamano: string; copias: number };
};

/** De dónde salen los archivos: R2, salvo en las pruebas. Null si no existe. */
export type LectorDeArchivos = (r2Key: string) => Promise<Buffer | null>;

const leerDeR2: LectorDeArchivos = async (r2Key) => ((await fileExistsInR2(r2Key)) ? readFromR2(r2Key) : null);

export type PrintExportPlan = {
  /** Carpeta del pedido dentro del ZIP. */
  folder: string;
  /** Número del pedido, para nombrar archivos cuando no hay carpeta por cliente. */
  codigo?: string;
  manifestHeader: string[];
  files: PrintExportFile[];
  pdfBytes: Uint8Array;
  /** Avisos de texto dentro de la carpeta del pedido (p. ej. un diseño todavía sin aprobar). */
  notes?: Array<{ name: string; content: string }>;
  /** Nombres del control y del resumen dentro de la carpeta (por defecto MANIFEST.txt y RESUMEN_PEDIDO.pdf). */
  manifestName?: string;
  summaryName?: string;
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

async function writePlan(
  archive: Archiver,
  plan: PrintExportPlan,
  leer: LectorDeArchivos,
  usadas: Set<string>,
): Promise<void> {
  const lines = [...plan.manifestHeader];
  for (const file of plan.files) {
    // Tope de largo para Windows y sin nombres repetidos (ver `rutas-cortas`).
    const zipPath = ajustarRuta(file.zipPath, usadas);
    let ok = false;
    try {
      const buffer = await leer(file.r2Key);
      if (buffer) {
        const final = file.transform ? Buffer.from(file.transform(buffer)) : buffer;
        await appendAndWait(archive, final, zipPath);
        ok = true;
      }
    } catch (err) {
      // Un archivo que no se puede leer no frena el resto: queda anotado en el MANIFEST.
      console.error("[print-export] no se pudo leer", file.r2Key, err);
    }
    lines.push(ok ? file.manifestLine.split(file.zipPath).join(zipPath) : file.missingLine);
  }
  for (const note of plan.notes ?? []) {
    await appendAndWait(archive, note.content, ajustarRuta(`${plan.folder}/${note.name}`, usadas));
  }
  await appendAndWait(archive, lines.join("\n"), ajustarRuta(`${plan.folder}/${plan.manifestName ?? "MANIFEST.txt"}`, usadas));
  await appendAndWait(
    archive,
    Buffer.from(plan.pdfBytes),
    ajustarRuta(`${plan.folder}/${plan.summaryName ?? "RESUMEN_PEDIDO.pdf"}`, usadas),
  );
}

export function streamPrintExportZip(
  plans: PrintExportPlan[],
  zipName: string,
  extras: Array<{ name: string; content: string }> = [],
  leer: LectorDeArchivos = leerDeR2,
): Response {
  const archive = archiver("zip", { store: true });
  archive.on("warning", (err) => console.warn("[print-export] advertencia", err));

  void (async () => {
    try {
      const usadas = new Set<string>();
      for (const plan of plans) await writePlan(archive, plan, leer, usadas);
      for (const extra of extras) await appendAndWait(archive, extra.content, ajustarRuta(extra.name, usadas));
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
