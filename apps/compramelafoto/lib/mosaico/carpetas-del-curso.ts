import "server-only";
import { COURSE_MOSAIC_VARIABLE_KEY } from "@repo/template-engine";
import { prisma } from "@/lib/prisma";
import { listTemplateV2ForAlbumPackPicker } from "@/lib/dashboard/template-v2-for-album-pack-picker";
import { createDesignV2Project } from "@/lib/design-v2/projects";
import { loadDesignTemplateVersion } from "@/lib/design-v2/template";
import { buildDesignValues, courseDisplayName } from "@/lib/design-v2/values";
import { armarCompaneros } from "./companeros";
import { MosaicoError, cursoDeLaClave } from "./curso";
import { completarMediciones, filasDelCurso, urlDeVistaDelRetrato } from "./retratos";

/**
 * «Armar las carpetas del curso»: con el curso cerrado, una carpeta por alumno con su retrato
 * oficial como foto grande y el mosaico de sus compañeros. Es un pedido del colegio o del
 * fotógrafo, fuera del circuito de la familia: no cobra nada; quedan como diseños para revisar,
 * aprobar e imprimir juntos.
 */

/** Las plantillas que puede usar el fotógrafo y que llevan el bloque «Mosaico del curso». */
export async function plantillasConMosaico(userId: number): Promise<Array<{ id: string; name: string }>> {
  const candidatas = await listTemplateV2ForAlbumPackPicker(userId);
  if (candidatas.length === 0) return [];
  const versiones = await prisma.templateV2.findMany({
    where: { id: { in: candidatas.map((c) => c.id) }, currentVersionId: { not: null } },
    select: { id: true, currentVersionId: true },
  });
  const conMosaico = await prisma.templateV2Block.findMany({
    where: {
      templateVersionId: { in: versiones.map((v) => v.currentVersionId!) },
      configJson: { path: ["variableKey"], equals: COURSE_MOSAIC_VARIABLE_KEY },
    },
    select: { templateVersionId: true },
    distinct: ["templateVersionId"],
  });
  const ok = new Set(conMosaico.map((b) => b.templateVersionId));
  const ids = new Set(versiones.filter((v) => ok.has(v.currentVersionId!)).map((v) => v.id));
  return candidatas.filter((c) => ids.has(c.id));
}

export type ResultadoDeCarpetas = { creadas: number; yaEstaban: number; sinRetrato: string[]; designIds: number[] };

export async function armarCarpetasDelCurso(input: {
  albumId: number;
  courseKey: string;
  templateId: string;
  photographerUserId: number;
  /** La foto grupal del curso, para el hueco «grupal» de la plantilla. */
  groupPhotoId?: number | null;
}): Promise<ResultadoDeCarpetas> {
  const curso = cursoDeLaClave(input.courseKey);
  if (!curso) throw new MosaicoError("Ese curso no existe.", 404);
  const estado = await prisma.albumCourseMosaic.findUnique({
    where: { albumId_courseKey: { albumId: input.albumId, courseKey: input.courseKey } },
    select: { closedAt: true },
  });
  if (!estado?.closedAt) throw new MosaicoError("Primero cerrá el curso: así los retratos ya no cambian.", 409);

  const plantillas = await plantillasConMosaico(input.photographerUserId);
  if (!plantillas.some((p) => p.id === input.templateId)) throw new MosaicoError("Elegí una plantilla con mosaico.", 422);
  const template = await loadDesignTemplateVersion({ templateId: input.templateId });
  if (!template) throw new MosaicoError("Esa plantilla ya no existe.", 410);

  if (input.groupPhotoId != null) {
    const n = await prisma.photo.count({ where: { id: input.groupPhotoId, albumId: input.albumId, isRemoved: false } });
    if (n !== 1) throw new MosaicoError("La foto grupal tiene que ser de este álbum.", 422);
  }

  const album = await prisma.album.findUnique({
    where: { id: input.albumId },
    select: { eventDate: true, school: { select: { name: true, logoUrl: true } }, user: { select: { name: true } } },
  });
  await completarMediciones(prisma, input.albumId, curso);
  const filas = (await filasDelCurso(prisma, input.albumId, curso)).map((f) => ({ ...f, urlDeVista: urlDeVistaDelRetrato(f.mosaicPhoto) }));
  const courseName = courseDisplayName(curso.courseName, curso.division);

  const resultado: ResultadoDeCarpetas = { creadas: 0, yaEstaban: 0, sinRetrato: [], designIds: [] };
  for (const f of filas) {
    if (f.mosaicPhotoId == null) {
      resultado.sinRetrato.push(`${f.snapshotFirstName} ${f.snapshotLastName}`.trim());
      continue;
    }
    const values = buildDesignValues({
      studentFirstName: f.snapshotFirstName,
      studentLastName: f.snapshotLastName,
      courseName,
      courseShift: curso.shift,
      schoolName: album?.school?.name,
      schoolLogoUrl: album?.school?.logoUrl,
      photographerName: album?.user?.name,
      eventDate: album?.eventDate,
      courseMosaic: armarCompaneros(filas, f.id),
      courseMosaicOwner: armarCompaneros([f], -1)[0] ?? null,
    });
    // Foto grande = el retrato del chico; después, la grupal. La maestra se pone al aprobar.
    const photoIds = [f.mosaicPhotoId, ...(input.groupPhotoId != null ? [input.groupPhotoId] : [])];
    const { id, created } = await createDesignV2Project(prisma, {
      template,
      photoIds,
      values,
      photographerUserId: input.photographerUserId,
      albumId: input.albumId,
      albumPackDraftId: `curso:${input.albumId}:${f.id}:${input.templateId}`,
    });
    if (created) {
      await prisma.designProject.update({ where: { id }, data: { rosterEntryId: f.id } });
      resultado.creadas++;
    } else resultado.yaEstaban++;
    resultado.designIds.push(id);
  }
  return resultado;
}

