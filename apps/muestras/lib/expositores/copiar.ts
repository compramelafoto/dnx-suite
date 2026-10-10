import "server-only";
import type { Prisma } from "@repo/db";
import { EXHIBITOR_TEXT_LIMITS } from "@repo/muestras";

/** La nota que ve quien expone cuando la organización saca su obra de la muestra. */
export const OBRA_DE_EXPOSITOR_QUITADA = "La organización la sacó de la muestra.";

/**
 * Título, año y técnica editados en la ficha (o en Textos) se copian a la obra del expositor, así
 * quien expone ve lo mismo que se imprime (spec D9). `deExpositor`: id de la obra de la muestra →
 * id de la obra del expositor. Siempre dentro de la misma muestra.
 *
 * Fuera de los archivos `"use server"` a propósito: recibe la transacción y no es una acción.
 */
export async function copiarTextosAExpositores(
  tx: Pick<Prisma.TransactionClient, "culturalExhibitorWork">,
  activityId: string,
  obras: ReadonlyArray<{ id?: string; title: string; year: number | null; technique: string | null }>,
  deExpositor: ReadonlyMap<string, string>,
) {
  for (const o of obras) {
    const ew = o.id ? deExpositor.get(o.id) : undefined;
    if (!ew) continue;
    await tx.culturalExhibitorWork.updateMany({
      where: { id: ew, activityId },
      data: {
        title: o.title.slice(0, EXHIBITOR_TEXT_LIMITS.title).trim(),
        year: o.year,
        technique: o.technique?.slice(0, EXHIBITOR_TEXT_LIMITS.technique).trim() || null,
      },
    });
  }
}
