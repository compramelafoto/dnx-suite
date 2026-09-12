import "server-only";

import { GetObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "@repo/db";
import { almacenamiento, bucket } from "@/lib/almacenamiento";
import { rekognition } from "./rekognition";
import type { Dependencias } from "./procesar";
import type { Perfil } from "./reglas";

/**
 * Enchufa el proceso de moderación a la base real y al bucket real.
 *
 * Toda la lógica difícil está en `procesar.ts` y se prueba sin esto. Acá sólo
 * hay traducción: Prisma para un lado, R2 para el otro.
 */
export function dependenciasReales(): Dependencias {
  return {
    async obtenerFoto(mediaId) {
      const foto = await prisma.subilafotoMedia.findFirst({
        // Sólo las que están esperando decisión. Una foto ya aprobada o
        // bloqueada no se vuelve a analizar aunque alguien reencole el trabajo.
        where: { id: mediaId, status: "PROCESSING" },
        select: {
          id: true,
          eventId: true,
          originalKey: true,
          event: { select: { moderationProfile: true } },
        },
      });
      if (!foto) return null;

      return {
        id: foto.id,
        eventId: foto.eventId,
        originalKey: foto.originalKey,
        perfil: foto.event.moderationProfile as Perfil,
      };
    },

    async descargar(clave) {
      const respuesta = await almacenamiento().send(
        new GetObjectCommand({ Bucket: bucket(), Key: clave }),
      );
      if (!respuesta.Body) throw Object.assign(new Error("Sin cuerpo"), { name: "SinCuerpo" });
      return new Uint8Array(await respuesta.Body.transformToByteArray());
    },

    proveedor: rekognition(),

    async guardar(entrada) {
      // La condición `status: PROCESSING` la resuelve la base, no este código:
      // si dos procesos llegan juntos, el segundo cambia cero filas y no
      // escribe ninguna decisión. Es lo que evita publicar dos veces.
      return prisma.$transaction(async (tx) => {
        const cambio = await tx.subilafotoMedia.updateMany({
          where: { id: entrada.mediaId, status: "PROCESSING" },
          data: {
            status: entrada.estado,
            ...(entrada.publicar ? { publishedAt: new Date() } : {}),
          },
        });

        if (cambio.count === 0) return false;

        await tx.subilafotoModerationDecision.create({
          data: {
            mediaId: entrada.mediaId,
            provider: entrada.proveedor,
            providerModel: entrada.modelo,
            policyVersion: entrada.versionDePolitica,
            profile: entrada.perfil,
            decision: entrada.estado,
            labels: entrada.etiquetas as unknown as object,
            topLabel: entrada.motivo,
            topConfidence: entrada.confianza,
            latencyMs: entrada.latenciaMs,
            errorCode: entrada.codigoDeError,
          },
        });

        return true;
      });
    },
  };
}

/** Devuelve las fotos que están esperando decisión, de la más vieja a la más nueva. */
export async function fotosPendientes(limite: number): Promise<string[]> {
  const filas = await prisma.subilafotoMedia.findMany({
    where: { status: "PROCESSING" },
    orderBy: { createdAt: "asc" },
    take: limite,
    select: { id: true },
  });
  return filas.map((f) => f.id);
}
