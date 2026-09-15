import "server-only";

import { PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { prisma } from "@repo/db";
import { almacenamiento, bucket } from "@/lib/almacenamiento";
import { MEDIDAS, claveDeVariante } from "./medidas";

/**
 * Genera las versiones reducidas de una foto y las guarda.
 *
 * Se llama desde el mismo paso que la modera, porque ahí los bytes del original ya están
 * en memoria: bajarlos otra vez sería pagar el mismo tráfico dos veces.
 *
 * **No corta la moderación si falla.** Una foto sin variante se puede volver a intentar;
 * una foto sin decisión queda retenida para siempre. El orden de importancia es ese.
 */

export type ResultadoDeLasVariantes = {
  generadas: number;
  error: string | null;
};

export async function generarVariantes(
  mediaId: string,
  original: string,
  bytes: Uint8Array,
): Promise<ResultadoDeLasVariantes> {
  try {
    /*
      Una sola decodificación para las dos medidas. `rotate()` sin argumentos aplica la
      orientación EXIF: sin eso, una foto sacada con el teléfono de costado se ve acostada
      en la pantalla del salón, que es exactamente donde se nota.
    */
    const fuente = sharp(Buffer.from(bytes), { failOn: "none" }).rotate();

    let generadas = 0;
    for (const medida of MEDIDAS) {
      const salida = await fuente
        .clone()
        // `withoutEnlargement`: si alguien sube una foto de 300px, no se agranda a 1920.
        // Estirarla la haría pesar más y verse peor.
        .resize({
          width: medida.ladoMayor,
          height: medida.ladoMayor,
          fit: "inside",
          withoutEnlargement: true,
        })
        // Sin metadatos: la variante es pública y el EXIF del original lleva el modelo del
        // teléfono y, muchas veces, las coordenadas de dónde se sacó.
        .jpeg({ quality: medida.calidad, mozjpeg: true })
        .toBuffer({ resolveWithObject: true });

      const clave = claveDeVariante(original, medida.etiqueta);

      await almacenamiento().send(
        new PutObjectCommand({
          Bucket: bucket(),
          Key: clave,
          Body: salida.data,
          ContentType: "image/jpeg",
        }),
      );

      // `upsert` sobre la única de (media, etiqueta): reprocesar la misma foto pisa la
      // variante en vez de crear una segunda fila apuntando al mismo archivo.
      await prisma.subilafotoMediaVariant.upsert({
        where: { mediaId_label: { mediaId, label: medida.etiqueta } },
        create: {
          mediaId,
          label: medida.etiqueta,
          storageKey: clave,
          width: salida.info.width,
          height: salida.info.height,
          bytes: salida.info.size,
          contentType: "image/jpeg",
        },
        update: {
          storageKey: clave,
          width: salida.info.width,
          height: salida.info.height,
          bytes: salida.info.size,
        },
      });

      generadas += 1;
    }

    return { generadas, error: null };
  } catch (e) {
    return { generadas: 0, error: e instanceof Error ? e.name : "desconocido" };
  }
}
