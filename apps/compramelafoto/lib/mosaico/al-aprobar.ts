import "server-only";
import { COURSE_MOSAIC_VARIABLE_KEY, isCourseMosaicConfig, serializeCourseMosaic } from "@repo/template-engine";
import { prisma } from "@/lib/prisma";
import type { DesignV2Data } from "@/lib/design-v2/design-data";
import type { DesignTemplateVersion } from "@/lib/design-v2/template";
import { cargarCompanerosDelMosaico, completarMediciones, cursoDeLaFila } from "./retratos";
import { leerIntegrantes } from "./token-del-colegio";

/** Un diseño con mosaico no se imprime mientras su curso no esté cerrado. */
export class CursoAbiertoError extends Error {}

export function plantillaTieneMosaico(template: DesignTemplateVersion): boolean {
  return (template.legacy.blocks as Array<{ configJson?: unknown }>).some((b) => isCourseMosaicConfig(b.configJson));
}

/** El alumno del padrón dueño de un diseño de preventa (null si no está en el padrón). */
export async function duenoDelDiseno(orderItemId: number | null | undefined): Promise<number | null> {
  if (!orderItemId) return null;
  const item = await prisma.preCompraOrderItem.findUnique({
    where: { id: orderItemId },
    select: { order: { select: { albumRosterEntryId: true } } },
  });
  return item?.order.albumRosterEntryId ?? null;
}

/**
 * Antes de imprimir una carpeta con mosaico: los compañeros se vuelven a armar con los retratos de
 * ahora (los de los demás se definen después de que esta familia canjeó), y la foto de la maestra
 * del curso va en su hueco si la familia no puso otra. Frena si el curso no está cerrado.
 *
 * Sin dueño en el padrón (o sin mosaico en la plantilla) devuelve los datos como están.
 */
export async function prepararMosaicoParaImprimir(input: {
  albumId: number | null;
  orderItemId: number | null;
  template: DesignTemplateVersion;
  data: DesignV2Data;
}): Promise<DesignV2Data> {
  if (!input.albumId || !plantillaTieneMosaico(input.template)) return input.data;
  const dueno = await duenoDelDiseno(input.orderItemId);
  if (!dueno) return input.data;
  const curso = await cursoDeLaFila(prisma, input.albumId, dueno);
  if (!curso) return input.data;
  if (!curso.cerrado) {
    throw new CursoAbiertoError(
      `El curso ${[curso.courseName, curso.division].filter(Boolean).join(" ")} todavía no está cerrado para el mosaico. Cerralo desde la pestaña «Mosaico» del álbum cuando todos tengan su retrato.`,
    );
  }
  await completarMediciones(prisma, input.albumId, curso);
  const companeros = (await cargarCompanerosDelMosaico(prisma, { albumId: input.albumId, rosterEntryId: dueno })) ?? [];

  const values = { ...input.data.values, [COURSE_MOSAIC_VARIABLE_KEY]: serializeCourseMosaic(companeros) };
  let slots = input.data.slots;
  let photoIds = input.data.photoIds;
  const huecoMaestra = input.template.slots.find((s) => s.role === "teacher");
  const maestra = leerIntegrantes(curso.staffJson).find((i) => i.photoId != null);
  if (huecoMaestra && maestra?.photoId && slots[huecoMaestra.blockId]?.photoId == null) {
    slots = { ...slots, [huecoMaestra.blockId]: { photoId: maestra.photoId, crop: { zoom: 1, x: 0, y: 0 } } };
    photoIds = photoIds.includes(maestra.photoId) ? photoIds : [...photoIds, maestra.photoId];
  }
  return { ...input.data, values, slots, photoIds };
}
