import "server-only";
import { prisma } from "@/lib/prisma";
import { corregirNombresEnValores, mismoNombre, type CambioDeNombre } from "./corregir-nombres";
import { parseDesignV2Data, type DesignV2Data } from "./design-data";
import {
  DESIGN_EDITABLE_STATUSES,
  DesignProjectError,
  loadDesignProjectForActor,
  saveDesignEdits,
  type DesignActor,
} from "./projects";

export type AlcanceDeLaCorreccion = "este" | "todos";

export type ResultadoDeLaCorreccion = {
  data: DesignV2Data;
  status: string | null;
  /** Libritos que cambiaron (este incluido). */
  disenos: number;
  /** De esos, los que estaban aprobados y volvieron a revisión. */
  volvieronARevision: number;
  /** Alumnos corregidos en la lista del colegio (sólo con «todos»). */
  padron: number;
};

/** Los textos que cambiaron, para guardarlos con `set-values`. */
function soloLosCambiados(values: Record<string, string>, cambiados: string[]): Record<string, string | null> {
  return Object.fromEntries(cambiados.map((k) => [k, values[k] ?? null]));
}

/**
 * El fotógrafo corrige nombres mal escritos: en este librito o en todos los del álbum que todavía
 * no se mandaron a imprimir. Con «todos» también se corrige la lista del colegio (el padrón del
 * álbum y el alumno del colegio), así los canjes que vienen ya salen bien.
 *
 * Un librito aprobado que cambia vuelve a revisión, como cualquier corrección: su archivo ya no
 * coincide.
 */
export async function corregirNombresDelDiseno(
  id: number,
  actor: DesignActor,
  cambios: CambioDeNombre[],
  alcance: AlcanceDeLaCorreccion,
): Promise<ResultadoDeLaCorreccion> {
  if (cambios.length === 0) throw new DesignProjectError("No hay nombres para corregir.", 400);
  const { project } = await loadDesignProjectForActor(id, actor);
  if (project.sentToPrintAt || project.printedAt) {
    throw new DesignProjectError("Este librito ya se mandó a imprimir: no se puede cambiar.", 422);
  }
  if (alcance === "todos" && !project.albumId) {
    throw new DesignProjectError("Este librito no es de un álbum: sólo se puede corregir acá.", 422);
  }

  const candidatos =
    alcance === "todos"
      ? await prisma.designProject.findMany({
          where: {
            albumId: project.albumId!,
            photographerUserId: project.photographerUserId,
            status: { in: [...DESIGN_EDITABLE_STATUSES] },
            sentToPrintAt: null,
            printedAt: null,
          },
          select: { id: true, status: true, currentRevision: { select: { dataJson: true } } },
          orderBy: { id: "asc" },
        })
      : [{ id, status: project.status, currentRevision: project.currentRevision }];

  let disenos = 0;
  let volvieronARevision = 0;
  for (const d of candidatos) {
    const data = parseDesignV2Data(d.currentRevision?.dataJson);
    if (!data) continue;
    const { values, cambiados } = corregirNombresEnValores(data.values, cambios);
    if (cambiados.length === 0) continue;
    await saveDesignEdits(d.id, actor, [{ kind: "set-values", values: soloLosCambiados(values, cambiados) }]);
    disenos++;
    if (d.status === "EXPORTED" || d.status === "APPROVED_FOR_EXPORT") volvieronARevision++;
  }

  let padron = 0;
  if (alcance === "todos") padron = await corregirNombresEnElPadron(project.albumId!, cambios);

  if (disenos === 0 && padron === 0) {
    throw new DesignProjectError("No encontramos ese nombre en el librito. Revisá cómo está escrito.", 422);
  }
  const final = await loadDesignProjectForActor(id, actor);
  return { data: final.data, status: final.project.status, disenos, volvieronARevision, padron };
}

/** Corrige los alumnos del padrón del álbum (y su ficha del colegio) que tienen el nombre viejo. */
async function corregirNombresEnElPadron(albumId: number, cambios: CambioDeNombre[]): Promise<number> {
  const filas = await prisma.albumStudentRosterEntry.findMany({
    where: { albumId },
    select: { id: true, studentId: true, snapshotFirstName: true, snapshotLastName: true },
  });
  let corregidos = 0;
  for (const f of filas) {
    const cambio = cambios.find((c) =>
      mismoNombre(c.de, { firstName: f.snapshotFirstName, lastName: f.snapshotLastName }),
    );
    if (!cambio) continue;
    await prisma.$transaction([
      prisma.albumStudentRosterEntry.update({
        where: { id: f.id },
        // Que la sincronización con la matrícula no vuelva a poner el nombre mal escrito.
        data: { snapshotFirstName: cambio.a.firstName, snapshotLastName: cambio.a.lastName, hasLocalOverrides: true },
      }),
      prisma.schoolStudent.update({
        where: { id: f.studentId },
        data: { firstName: cambio.a.firstName, lastName: cambio.a.lastName },
      }),
    ]);
    corregidos++;
  }
  return corregidos;
}
