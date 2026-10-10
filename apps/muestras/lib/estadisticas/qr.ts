import "server-only";
import { prisma } from "@repo/db";
import { ACTIVITY_LEVEL, isQrKind, metricForQrKind, workPath, type StatMetric } from "@repo/muestras";

export type DestinoQr = { path: string; activityId: string; workId: string; metric: StatMetric };

const ID = /^[A-Za-z0-9_-]{1,64}$/;
const publicada = (a: { reviewStatus: string; type: string }) => a.reviewStatus === "APPROVED" && a.type === "MUESTRA";
const SELECT = { id: true, slug: true, reviewStatus: true, type: true } as const;

/** A dónde lleva un QR impreso, o `null` si ya no lleva a nada publicado. */
export async function destinoDelQr(tipo: string, id: string): Promise<DestinoQr | null> {
  if (!isQrKind(tipo) || !ID.test(id)) return null;
  // El código de sala (etapa 6) da el pase y lo resuelve la vista de sala: hasta que esté, a la portada.
  if (tipo === "s") return null;
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
