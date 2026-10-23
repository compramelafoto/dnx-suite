import "server-only";
import { serializeClassListGroups } from "@repo/template-engine";
import { prisma } from "@/lib/prisma";
import { loadAlbumCourses } from "./class-list";
import type { DesignV2Data } from "./design-data";
import {
  armarListadoConCursos,
  avisoDeMuchaGente,
  clavesDeCursosSumados,
  cursoParaElegir,
  cursosDelListado,
  cursosParaSumar,
  fotoGrupalDelDiseno,
  listadoPermiteSumarCursos,
  plantillaTieneListado,
  type AvisoDeMuchaGente,
  type CursoParaElegir,
} from "./listado-cursos";
import { DesignProjectError, loadDesignProjectForActor, loadTemplateForDesign, saveDesignEdits, type DesignActor } from "./projects";
import type { DesignTemplateVersion } from "./template";

/** Lo que muestra la revisión del fotógrafo sobre el «Listado del curso» del diseño. */
export type ListadoDelDiseno = {
  /** La plantilla tiene el bloque del listado. */
  tieneListado: boolean;
  /** La plantilla deja sumar otros cursos (opción del bloque). */
  permiteSumar: boolean;
  /** Los cursos que lleva ahora, en orden (el primero es el del alumno). */
  cursos: Array<{ title: string; count: number }>;
  /** Los otros cursos del colegio que se pueden sumar (vacío si la plantilla no deja). */
  paraSumar: CursoParaElegir[];
  /** Claves de los cursos ya sumados. */
  sumados: string[];
  /** Caras contadas en la foto grupal del diseño; null si no hay foto grupal o no se analizó. */
  carasEnLaGrupal: number | null;
  aviso: AvisoDeMuchaGente | null;
};

/** Caras detectadas en una foto; null si la foto todavía no se analizó. */
export async function carasEnLaFoto(photoId: number): Promise<number | null> {
  const [photo, count] = await Promise.all([
    prisma.photo.findUnique({ where: { id: photoId }, select: { analyzedAt: true } }),
    prisma.faceDetection.count({ where: { photoId } }),
  ]);
  if (count > 0) return count;
  return photo?.analyzedAt ? 0 : null;
}

export async function loadListadoDelDiseno(input: {
  albumId: number | null;
  data: DesignV2Data;
  template: DesignTemplateVersion;
}): Promise<ListadoDelDiseno> {
  const blocks = input.template.legacy.blocks as Array<{ type: string; configJson?: unknown }>;
  const tieneListado = plantillaTieneListado(blocks);
  const permiteSumar = tieneListado && listadoPermiteSumarCursos(blocks);
  const groups = cursosDelListado(input.data.values);
  const disponibles = permiteSumar && input.albumId ? await loadAlbumCourses(prisma, input.albumId) : [];
  const fotoGrupal = tieneListado ? fotoGrupalDelDiseno(input.template.slots, input.data.slots) : null;
  const caras = fotoGrupal != null ? await carasEnLaFoto(fotoGrupal) : null;
  return {
    tieneListado,
    permiteSumar,
    cursos: groups.map((g) => ({ title: g.title, count: g.students.length })),
    paraSumar: cursosParaSumar(groups, disponibles).map(cursoParaElegir),
    sumados: clavesDeCursosSumados(groups, disponibles),
    carasEnLaGrupal: caras,
    aviso: avisoDeMuchaGente(caras, groups),
  };
}

/**
 * El fotógrafo suma o saca cursos del listado: el listado se rearma con el padrón del álbum (o
 * los packs del Excel) y se guarda como cualquier otra corrección.
 */
export async function guardarCursosDelListado(
  id: number,
  actor: DesignActor,
  claves: string[],
): Promise<DesignV2Data> {
  const { project, data } = await loadDesignProjectForActor(id, actor);
  const template = await loadTemplateForDesign(data);
  const blocks = template.legacy.blocks as Array<{ type: string; configJson?: unknown }>;
  if (!listadoPermiteSumarCursos(blocks)) {
    throw new DesignProjectError("Esta plantilla no deja sumar otros cursos al listado.", 422);
  }
  const groups = cursosDelListado(data.values);
  if (groups.length === 0) throw new DesignProjectError("Este diseño no tiene listado del curso.", 422);
  const disponibles = project.albumId ? await loadAlbumCourses(prisma, project.albumId) : [];
  if (claves.length > 0 && disponibles.length === 0) {
    throw new DesignProjectError("No encontramos los otros cursos de este colegio.", 422);
  }
  const value = serializeClassListGroups(armarListadoConCursos(groups, disponibles, claves));
  return saveDesignEdits(id, actor, [{ kind: "set-class-list", value }]);
}
