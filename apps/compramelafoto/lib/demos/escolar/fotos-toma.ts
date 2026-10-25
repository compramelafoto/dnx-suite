/**
 * Las fotos de la demo escolar se cargan de antemano pero quedan sin publicar: en la vida real la
 * preventa pasa antes de la toma, y la página de preventa solo existe mientras el álbum no tiene
 * fotos. En el paso «Subís las fotos» el presentador las publica con un botón (y puede subir alguna
 * más a mano); «Reiniciar» las vuelve a esconder.
 */

import { prisma } from "@/lib/prisma";
import { runAnalysisPipeline } from "@/lib/analysis/analysis-runner";

/** Motivo con el que quedan ocultas las fotos sembradas: solo estas se publican y se esconden. */
export const FOTOS_SIN_PUBLICAR = "DEMO_SIN_PUBLICAR";

export async function publicarFotosDeLaToma(albumId: number): Promise<{ publicadas: number; analizadas: number }> {
  const r = await prisma.photo.updateMany({
    where: { albumId, isRemoved: true, removedReason: FOTOS_SIN_PUBLICAR },
    data: { isRemoved: false, removedAt: null, removedReason: null },
  });
  // El análisis ignora fotos ocultas: se corre ahora para que la selfie funcione enseguida.
  let analizadas = 0;
  try {
    const res = await runAnalysisPipeline({
      ocrRequested: false,
      debug: false,
      source: "admin",
      albumId,
      maxRunMs: 90_000,
    });
    const body = (await res.json().catch(() => null)) as { processed?: number } | null;
    analizadas = Number(body?.processed ?? 0);
  } catch (err) {
    console.error("[DEMO] análisis de las fotos publicadas falló", err);
  }
  return { publicadas: r.count, analizadas };
}

/** Vuelve a esconder las fotos sembradas (las que tienen nombre de archivo de la demo). */
export async function ocultarFotosDeLaToma(albumId: number): Promise<number> {
  const r = await prisma.photo.updateMany({
    where: { albumId, isRemoved: false, originalFilename: { not: null } },
    data: { isRemoved: true, removedAt: new Date(), removedReason: FOTOS_SIN_PUBLICAR },
  });
  return r.count;
}
