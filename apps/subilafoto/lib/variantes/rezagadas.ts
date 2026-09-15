import "server-only";

import { GetObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "@repo/db";
import { almacenamiento, bucket } from "@/lib/almacenamiento";
import { generarVariantes } from "./generar";

/**
 * Las fotos decididas que se quedaron sin variante.
 *
 * Normalmente no hay ninguna: la variante se genera en el mismo paso que modera, antes de
 * escribir la decisión. Acá caen las que fallaron —un HEIC raro, un corte a mitad de la
 * subida a R2— y que si no, no se recuperan solas: nadie vuelve a moderar una foto ya
 * decidida.
 *
 * Sin esto, una foto sin variante es una foto invisible para siempre: no está en el álbum,
 * no está en la pantalla y en el panel es un recuadro vacío. Y el original está ahí,
 * entero, esperando entrar en el ZIP que el cliente pagó.
 */

/** Cuántas por vuelta. Pocas: es una red de seguridad, no el camino normal. */
const TOPE = 5;

export async function generarVariantesRezagadas(limite = TOPE): Promise<{
  revisadas: number;
  generadas: number;
  fallidas: number;
}> {
  const fotos = await prisma.subilafotoMedia.findMany({
    where: {
      // Una bloqueada no se muestra en ningún lado: no necesita variante.
      status: { in: ["APPROVED", "REVIEW_REQUIRED"] },
      variants: { none: {} },
      originalKey: { not: "" },
    },
    orderBy: { createdAt: "asc" },
    take: limite,
    select: { id: true, originalKey: true },
  });

  let generadas = 0;
  let fallidas = 0;

  for (const foto of fotos) {
    try {
      const respuesta = await almacenamiento().send(
        new GetObjectCommand({ Bucket: bucket(), Key: foto.originalKey }),
      );
      if (!respuesta.Body) throw new Error("Sin cuerpo");
      const bytes = new Uint8Array(await respuesta.Body.transformToByteArray());

      const r = await generarVariantes(foto.id, foto.originalKey, bytes);
      if (r.error) {
        fallidas += 1;
        console.error("[subilafoto][variantes] rezagada sin arreglo", {
          mediaId: foto.id,
          error: r.error,
        });
      } else {
        generadas += 1;
      }
    } catch (e) {
      fallidas += 1;
      console.error("[subilafoto][variantes] no se pudo bajar la rezagada", {
        mediaId: foto.id,
        error: e instanceof Error ? e.name : "desconocido",
      });
    }
  }

  return { revisadas: fotos.length, generadas, fallidas };
}
