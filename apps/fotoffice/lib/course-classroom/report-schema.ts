import { z } from "zod";

const esquema = z.object({
  courseId: z.string().min(1).max(40),
  lessonId: z.string().min(1).max(40),
  positionSeconds: z.number().finite().min(0).max(24 * 60 * 60),
  watchedSinceLastReport: z.number().finite().min(0).max(60 * 60),
});

/** El cuerpo llega del navegador: se valida forma y rango antes de mirarlo. */
export function leerReporte(
  cuerpo: unknown,
):
  | { ok: true; reporte: { courseId: string; lessonId: string; positionSeconds: number; watchedSinceLastReport: number } }
  | { ok: false } {
  const r = esquema.safeParse(cuerpo);
  return r.success ? { ok: true, reporte: r.data } : { ok: false };
}
