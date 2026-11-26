import "server-only";
import { getR2ObjectMetadata, getSignedUrlForFile } from "@/lib/r2-client";
import type { FilaConClave } from "./verificacion";
import type { ArchivoAVerificar } from "./verificacion-reglas";

/**
 * Completa la verificación con lo que sólo sabe R2: si el archivo está (si no, el ZIP lo anota
 * como FALTA), cuánto pesa y una URL firmada para verlo. Es el archivo original, el mismo que baja
 * el laboratorio, no una vista previa con marca de agua.
 */

export type ArchivoVerificado = ArchivoAVerificar & {
  pesoBytes: number | null;
  falta: boolean;
  /** URL para ver el archivo tal cual llega. */
  url: string | null;
  /** Imágenes para mostrar un PDF (sus caras en JPG); vacío si es una foto. */
  vistas: string[];
};

/** La URL vale una hora: alcanza para revisar el lote entero sin que caduque a mitad de camino. */
const VALIDEZ_URL_SEGUNDOS = 60 * 60;
const DE_A = 8;

export async function verificarEnR2(filas: readonly FilaConClave[]): Promise<ArchivoVerificado[]> {
  const salida: ArchivoVerificado[] = [];
  for (let i = 0; i < filas.length; i += DE_A) {
    const tanda = await Promise.all(
      filas.slice(i, i + DE_A).map(async ({ r2Key, vistaPrevia, ...fila }) => {
        let pesoBytes: number | null = null;
        let falta = !r2Key;
        if (r2Key) {
          try {
            pesoBytes = (await getR2ObjectMetadata(r2Key)).size;
          } catch {
            falta = true;
          }
        }
        const url = falta ? null : await getSignedUrlForFile(r2Key, VALIDEZ_URL_SEGUNDOS);
        const vistas = await Promise.all(vistaPrevia.map((k) => getSignedUrlForFile(k, VALIDEZ_URL_SEGUNDOS)));
        return { ...fila, pesoBytes, falta, url, vistas };
      }),
    );
    salida.push(...tanda);
  }
  return salida;
}
