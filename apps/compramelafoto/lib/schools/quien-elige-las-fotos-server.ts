import "server-only";
import { prisma } from "@/lib/prisma";
import { leerRegla, type ReglaEleccion } from "@/lib/schools/quien-elige-las-fotos";

/** La regla de un álbum (sin fila: la familia elige). */
export async function cargarRegla(albumId: number): Promise<ReglaEleccion> {
  const fila = await prisma.schoolPhotoChooserSetting.findUnique({
    where: { albumId },
    select: { mode: true, familyDays: true },
  });
  return leerRegla(fila);
}

/** Las reglas de varios álbumes de una vez (los que no tienen fila quedan en FAMILY). */
export async function cargarReglas(albumIds: number[]): Promise<Map<number, ReglaEleccion>> {
  const ids = [...new Set(albumIds.filter((id) => Number.isInteger(id) && id > 0))];
  const filas = ids.length
    ? await prisma.schoolPhotoChooserSetting.findMany({
        where: { albumId: { in: ids } },
        select: { albumId: true, mode: true, familyDays: true },
      })
    : [];
  const porAlbum = new Map(filas.map((f) => [f.albumId, f] as const));
  return new Map(ids.map((id) => [id, leerRegla(porAlbum.get(id) ?? null)] as const));
}
