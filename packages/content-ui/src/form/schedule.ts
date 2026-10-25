import type { ContentPostFormValue } from "../types";

/**
 * Publicación programada: un artículo PUBLISHED con `publishedAt` en el futuro. Las consultas
 * públicas ya lo ocultan hasta esa hora (`publishedWhereFor`), así que programar no necesita
 * un estado nuevo ni una tarea que lo "publique": a la hora elegida empieza a verse solo. PURO.
 */

function parse(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isScheduledPublication(
  status: ContentPostFormValue["status"],
  publishedAt: string | null | undefined,
  now: Date = new Date()
): boolean {
  const date = parse(publishedAt);
  return status === "PUBLISHED" && date !== null && date.getTime() > now.getTime();
}

export type ContentPublishAction = "publishNow" | "schedule" | "save";

/**
 * Qué `publishedAt` mandar según el botón. `undefined` = no mandar nada (el servidor conserva la
 * fecha que ya tenía, o pone "ahora" si nunca se publicó).
 *
 * - "Publicar ahora" sobre uno programado lo adelanta a este momento; sobre uno ya publicado
 *   conserva su fecha original.
 * - "Programar" manda la fecha elegida; `null` si no es futura (el formulario avisa y no guarda).
 * - "Guardar cambios" de uno programado respeta la fecha del campo, por si se la cambió. De uno
 *   ya publicado no la manda: el campo no guarda segundos y la fecha original se correría.
 */
export function publishedAtFor(
  action: ContentPublishAction,
  form: Pick<ContentPostFormValue, "status" | "publishedAt">,
  now: Date = new Date()
): string | null | undefined {
  const chosen = parse(form.publishedAt);
  if (action === "schedule") {
    return chosen && chosen.getTime() > now.getTime() ? chosen.toISOString() : null;
  }
  if (action === "publishNow") {
    return chosen && chosen.getTime() > now.getTime() ? now.toISOString() : undefined;
  }
  return isScheduledPublication(form.status, form.publishedAt, now) && chosen ? chosen.toISOString() : undefined;
}
