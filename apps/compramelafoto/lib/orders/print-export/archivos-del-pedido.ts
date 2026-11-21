/**
 * Archivos de la carpeta de impresión de un pedido de álbum: las copias sueltas y, si se piden,
 * los diseños (PDF y caras del librito o la carpeta escolar, o el aviso de que falta aprobarlo).
 *
 * Sin base de datos ni R2, para poder probarlo: lo usa `album-order-print-plan`. El lote de
 * impresión de pedidos comunes pide `incluirDisenos: false` porque los diseños siguen la línea
 * escolar y al laboratorio de copias van sólo las sueltas.
 */

import path from "path";
import { urlToR2Key } from "@/lib/r2-public-url";
import { safeFilename } from "@/lib/safe-filename";
import type { PrintExportFile } from "./stream-print-export-zip";
import type { OrderDesign } from "./order-designs";
import { acabadoCorto, carpetaDeImpresion, nombreDeCopia, recortar, tamanoCorto } from "./rutas-cortas";

type ItemDelPedido = {
  photoId: number;
  quantity: number;
  size?: string | null;
  finish?: string | null;
  metadata?: unknown;
  photo?: { originalKey: string | null } | null;
};

const safeName = (name: string) => safeFilename(name, "Cliente");

export function archivosDelPedido(input: {
  /** Todos los ítems PRINT/FRAME del pedido (para ubicar el producto de cada diseño). */
  items: readonly ItemDelPedido[];
  /** Las copias fuera del diseño, ya con el acabado para exportar. */
  sueltas: readonly ItemDelPedido[];
  designs: readonly OrderDesign[];
  folder: string;
  getProductName: (size: string, acabado: string, metadata?: unknown) => string;
  incluirDisenos: boolean;
}): { files: PrintExportFile[]; notes: Array<{ name: string; content: string }>; designLines: string[] } {
  const { items, sueltas, folder, getProductName } = input;

  const files: PrintExportFile[] = sueltas.map((it) => {
    const finish = acabadoCorto(it.finish);
    const size = tamanoCorto(it.size);
    const qty = Number(it.quantity || 0);
    const productName = safeName(getProductName(String(it.size || ""), String(it.finish || ""), it.metadata));
    const originalKey = it.photo?.originalKey ?? "";
    const baseName = path.basename(originalKey) || `foto-${it.photoId}`;
    const impresion = { producto: productName, acabado: finish, tamano: size, copias: qty };
    const zipPath = `${folder}/${carpetaDeImpresion(impresion)}/${nombreDeCopia(qty, baseName)}`;
    return {
      zipPath,
      r2Key: urlToR2Key(originalKey),
      manifestLine: `${productName} | ${finish || "-"} | ${size} | ${qty} | ${zipPath}`,
      missingLine: `${productName} | ${finish || "-"} | ${size} | ${qty} | (FALTA ARCHIVO)`,
      impresion,
    };
  });

  const notes: Array<{ name: string; content: string }> = [];
  const designLines: string[] = [];
  if (!input.incluirDisenos) return { files, notes, designLines };

  // Carpeta del producto de cada diseño: la de las fotos que lo forman.
  const productoDeDiseno = (photoIds: number[]) => {
    const it = items.find((i) => photoIds.includes(i.photoId));
    return safeName(
      recortar(it ? getProductName(String(it.size || ""), String(it.finish || ""), it.metadata) : "Disenos", 24)
    );
  };
  for (const d of input.designs) {
    const producto = productoDeDiseno(d.photoIds);
    const titulo = recortar(safeName(`Diseno ${d.id}${d.templateName ? ` ${d.templateName}` : ""}`), 30);
    if (d.ready && d.pdfUrl) {
      const pdfPath = `${folder}/${producto}/${titulo}.pdf`;
      files.push({
        zipPath: pdfPath,
        r2Key: urlToR2Key(d.pdfUrl),
        manifestLine: `${producto} | DISEÑO | ${d.id} | 1 | ${pdfPath}`,
        missingLine: `${producto} | DISEÑO | ${d.id} | 1 | (FALTA EL PDF DEL DISEÑO)`,
      });
      d.jpgUrls.forEach((url, i) => {
        const jpgPath = `${folder}/${producto}/${titulo} caras/Cara ${i + 1}.jpg`;
        files.push({
          zipPath: jpgPath,
          r2Key: urlToR2Key(url),
          manifestLine: `${producto} | DISEÑO cara ${i + 1} | ${d.id} | 1 | ${jpgPath}`,
          missingLine: `${producto} | DISEÑO cara ${i + 1} | ${d.id} | 1 | (FALTA ARCHIVO)`,
        });
      });
      designLines.push(`  • ${producto}: diseño ${d.id} listo (PDF incluido)`);
    } else {
      notes.push({
        name: `DISENO ${d.id} PENDIENTE DE APROBAR.txt`,
        content: [
          `El diseño ${d.id}${d.templateName ? ` (${d.templateName})` : ""} todavía no está aprobado.`,
          "",
          "Aprobalo desde el panel, en Diseños. Cuando esté aprobado, volvé a exportar este pedido:",
          "el PDF listo para imprimir va a aparecer en esta carpeta.",
          "",
          `Fotos que lleva: ${d.photoIds.length}. No se incluyen sueltas porque se imprimen dentro del diseño.`,
        ].join("\n"),
      });
      designLines.push(`  • ${producto}: diseño ${d.id} PENDIENTE DE APROBAR`);
    }
  }
  return { files, notes, designLines };
}
