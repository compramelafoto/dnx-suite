import { prisma } from "@/lib/prisma";
import { shouldRunOcr } from "./should-run-ocr";

/**
 * Releer el texto de un álbum cuando el fotógrafo enciende la búsqueda por número.
 *
 * La lectura se decide al analizar cada foto (`should-run-ocr`). Si el fotógrafo sube las
 * fotos y recién después enciende el interruptor, esas fotos ya se analizaron sin leer
 * nada y el buscador por número no aparece nunca. Le pasó a Lorenzo Perego (fútbol, álbum
 * 1221, 26/10/2026): 362 fotos, cero números.
 *
 * Vuelven a la cola marcadas `soloTexto`: el analizador lee el texto y no toca las caras.
 * Reanalizar completo indexaría cada cara otra vez en Amazon —pagando de nuevo y dejando
 * las anteriores huérfanas en la colección—.
 */

type ConfigDeLectura = { textSearchEnabled: boolean | null; type: string | null };

const lee = (a: ConfigDeLectura) =>
  shouldRunOcr({ textSearchEnabled: a.textSearchEnabled, albumType: a.type, requested: null });

/** Sólo el paso de "no se leía" a "se lee": guardar otro ajuste no vuelve a gastar. */
export function lecturaSeEncendio(antes: ConfigDeLectura, despues: ConfigDeLectura): boolean {
  return !lee(antes) && lee(despues);
}

/** Devuelve cuántas fotos quedaron en la cola. */
export async function encolarLecturaDeTexto(albumId: number): Promise<number> {
  const fotos = await prisma.photo.findMany({
    where: { albumId, isRemoved: false, analysisStatus: "DONE", ocrTokens: { none: {} } },
    select: { id: true, analysisJob: { select: { id: true } } },
  });
  if (fotos.length === 0) return 0;

  const conTrabajo = fotos.filter((f) => f.analysisJob).map((f) => f.id);
  const sinTrabajo = fotos.filter((f) => !f.analysisJob).map((f) => f.id);

  // Un trabajo PENDING o PROCESSING ya va a pasar por el analizador con el interruptor nuevo.
  const actualizados = conTrabajo.length
    ? await prisma.photoAnalysisJob.updateMany({
        where: { photoId: { in: conTrabajo }, status: { in: ["DONE", "ERROR"] } },
        data: { status: "PENDING", soloTexto: true, attempts: 0, lockedAt: null, runAfter: null, lastError: null },
      })
    : { count: 0 };
  const creados = sinTrabajo.length
    ? await prisma.photoAnalysisJob.createMany({
        data: sinTrabajo.map((photoId) => ({ photoId, status: "PENDING" as const, soloTexto: true })),
        skipDuplicates: true,
      })
    : { count: 0 };

  return actualizados.count + creados.count;
}
