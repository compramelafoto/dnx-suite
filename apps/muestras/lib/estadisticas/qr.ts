import "server-only";
import { prisma } from "@repo/db";
import { ACTIVITY_LEVEL, isQrKind, isRoomCode, metricForQrKind, workPath, type StatMetric } from "@repo/muestras";

/** `pase`: el QR es un código de sala (etapa 6) y da el pase de sala de esa obra. */
export type DestinoQr = { path: string; activityId: string; workId: string; metric: StatMetric; pase?: true };

const ID = /^[A-Za-z0-9_-]{1,64}$/;
const publicada = (a: { reviewStatus: string; type: string }) => a.reviewStatus === "APPROVED" && a.type === "MUESTRA";
const SELECT = { id: true, slug: true, reviewStatus: true, type: true } as const;

/** A dónde lleva un QR impreso, o `null` si ya no lleva a nada publicado. */
export async function destinoDelQr(tipo: string, id: string): Promise<DestinoQr | null> {
  if (!isQrKind(tipo)) return null;
  // El código de sala (etapa 6, D29): sólo está impreso en las fichas. Da el pase de sala y lleva a
  // la vista de sala de esa obra, si la obra sigue en la muestra y la muestra está publicada.
  if (tipo === "s") {
    if (!isRoomCode(id)) return null;
    const c = await prisma.culturalActivityRoomCode.findUnique({ where: { code: id }, select: { workId: true, activity: { select: SELECT } } });
    if (!c || !publicada(c.activity)) return null;
    const w = await prisma.culturalActivityWork.findFirst({ where: { id: c.workId, activityId: c.activity.id }, select: { id: true } });
    if (!w) return null;
    const path = `/m/${encodeURIComponent(c.activity.slug)}/sala/o/${encodeURIComponent(w.id)}`;
    return { path, activityId: c.activity.id, workId: w.id, metric: metricForQrKind("s"), pase: true };
  }
  if (!ID.test(id)) return null;
  if (tipo === "o") {
    const w = await prisma.culturalActivityWork.findUnique({ where: { id }, select: { id: true, activity: { select: SELECT } } });
    if (!w || !publicada(w.activity)) return null;
    return { path: workPath(w.activity.slug, w.id), activityId: w.activity.id, workId: w.id, metric: metricForQrKind("o") };
  }
  const a = await prisma.culturalActivity.findUnique({ where: { id }, select: SELECT });
  if (!a || !publicada(a)) return null;
  const path = tipo === "l" ? `/m/${encodeURIComponent(a.slug)}/libro` : `/m/${encodeURIComponent(a.slug)}`;
  return { path, activityId: a.id, workId: ACTIVITY_LEVEL, metric: metricForQrKind(tipo) };
}
