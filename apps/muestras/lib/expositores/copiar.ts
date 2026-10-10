import "server-only";
import type { Prisma } from "@repo/db";
import { EXHIBITOR_TEXT_LIMITS } from "@repo/muestras";

/** La nota que ve quien expone cuando la organización saca su obra de la muestra. */
export const OBRA_DE_EXPOSITOR_QUITADA = "La organización la sacó de la muestra.";

export type TextosDeObra = { title: string; year: number | null; technique: string | null };

/**
 * Título, año y técnica editados en la ficha (o en Textos) se copian a la obra del expositor, así
 * quien expone ve lo mismo que se imprime (spec D9). `deExpositor`: id de la obra de la muestra →
 * id de la obra del expositor. `antes`: los textos de cada obra de la muestra antes de guardar.
 *
 * Sólo a obras **aprobadas** y sólo **lo que cambió** respecto de la obra de la muestra: guardar la
 * ficha sin tocar un título no pisa lo que quien expone está corrigiendo (una obra con cambios
 * pedidos, por ejemplo). Siempre dentro de la misma muestra.
 *
 * Fuera de los archivos `"use server"` a propósito: recibe la transacción y no es una acción.
 */
export async function copiarTextosAExpositores(
  tx: Pick<Prisma.TransactionClient, "culturalExhibitorWork">,
  activityId: string,
  obras: ReadonlyArray<{ id?: string } & TextosDeObra>,
  deExpositor: ReadonlyMap<string, string>,
  antes: ReadonlyMap<string, TextosDeObra>,
) {
  for (const o of obras) {
    const ew = o.id ? deExpositor.get(o.id) : undefined;
    if (!ew || !o.id) continue;
    const previa = antes.get(o.id);
    const title = o.title.slice(0, EXHIBITOR_TEXT_LIMITS.title).trim();
    const technique = o.technique?.slice(0, EXHIBITOR_TEXT_LIMITS.technique).trim() || null;
    const data: Prisma.CulturalExhibitorWorkUpdateManyMutationInput = {};
    if (!previa || previa.title !== o.title) data.title = title;
    if (!previa || previa.year !== o.year) data.year = o.year;
    if (!previa || (previa.technique ?? null) !== (o.technique ?? null)) data.technique = technique;
    if (Object.keys(data).length === 0) continue;
    await tx.culturalExhibitorWork.updateMany({ where: { id: ew, activityId, status: "APPROVED" }, data });
  }
}
