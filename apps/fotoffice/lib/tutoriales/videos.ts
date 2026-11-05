import "server-only";
import { prisma } from "@repo/db";
import { clasesDelCurso, leerVideos, type CursoTutorial, type VideosDelCurso } from "./curso";

/** Los links de YouTube del curso, tal como se cargaron en /admin/tutoriales. */
export async function videosDelCurso(curso: CursoTutorial): Promise<VideosDelCurso> {
  const fila = await prisma.systemSettings
    .findUnique({ where: { key: curso.claveAjuste } })
    .catch(() => null);
  return leerVideos(fila?.value, clasesDelCurso(curso).map((c) => c.clave));
}

export async function guardarVideosDelCurso(curso: CursoTutorial, videos: VideosDelCurso): Promise<void> {
  const value = JSON.stringify({ videos });
  await prisma.systemSettings.upsert({
    where: { key: curso.claveAjuste },
    create: { key: curso.claveAjuste, value, description: `Links de YouTube de ${curso.titulo}` },
    update: { value },
  });
}
