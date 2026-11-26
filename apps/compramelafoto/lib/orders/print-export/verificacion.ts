/**
 * «Verificar lote»: la lista de lo que recibe el laboratorio, archivo por archivo, armada con los
 * mismos planes y las mismas rutas que el ZIP (`rutasDelPlan`). Así lo que el fotógrafo revisa es
 * exactamente lo que va a llegar: mismo nombre, misma carpeta, mismas copias.
 *
 * Sin base de datos ni R2, para poder probarlo. El peso, si falta, y las URL para ver cada archivo
 * los agrega `verificacion-servidor`; lo que se muestra, `verificacion-reglas`.
 */

import path from "path";
import { rutasDelPlan, type PrintExportPlan } from "./stream-print-export-zip";
import { CARPETA_CONTROL } from "./organizar-por-tamano";
import type { ArchivoAVerificar } from "./verificacion-reglas";

export type { ArchivoAVerificar, TipoDeArchivo } from "./verificacion-reglas";

export type FilaConClave = ArchivoAVerificar & { r2Key: string; vistaPrevia: string[] };

/** «Control/3888 Juan Perez» o «3888 Juan Perez» → «Juan Perez». Null si no hay nombre. */
function clienteDeLaCarpeta(folder: string, codigo: string | undefined): string | null {
  const sinControl = folder.startsWith(`${CARPETA_CONTROL}/`) ? folder.slice(CARPETA_CONTROL.length + 1) : folder;
  if (!codigo) return null;
  const resto = sinControl.startsWith(`${codigo} `) ? sinControl.slice(codigo.length + 1).trim() : "";
  return resto || null;
}

/**
 * Las fotos y PDF de un ZIP, en el orden en que entran. `usadas` es el registro de nombres del ZIP:
 * uno por ZIP (o por parte), igual que `streamPrintExportZip`. No incluye los archivos de control
 * (MANIFEST, resúmenes, remito): esos se listan aparte.
 */
export function filasDelZip(plans: readonly PrintExportPlan[], zip: string, desde = 1): FilaConClave[] {
  const usadas = new Set<string>();
  const filas: FilaConClave[] = [];
  for (const plan of plans) {
    const rutas = rutasDelPlan(plan, usadas);
    plan.files.forEach((file, i) => {
      const ruta = rutas.files[i]!;
      const carpeta = path.posix.dirname(ruta);
      filas.push({
        n: desde + filas.length,
        zip,
        ruta,
        archivo: path.posix.basename(ruta),
        carpeta: carpeta === "." ? "" : carpeta,
        tipo: /\.pdf$/i.test(ruta) ? "PDF" : "FOTO",
        pedido: plan.codigo ?? null,
        cliente: clienteDeLaCarpeta(plan.folder, plan.codigo),
        detalle: file.detalle ?? null,
        producto: file.impresion?.producto || null,
        tamano: file.impresion?.tamano || null,
        acabado: file.impresion?.acabado || null,
        copias: file.impresion?.copias ?? 1,
        r2Key: file.r2Key,
        vistaPrevia: file.vistaPrevia ?? [],
      });
    });
  }
  return filas;
}
