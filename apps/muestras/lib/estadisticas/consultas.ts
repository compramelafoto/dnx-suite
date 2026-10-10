import "server-only";
import { prisma } from "@repo/db";
import { statsWindow } from "@repo/muestras";
import { conPermiso } from "@/lib/equipo/permisos";
import type { Usuario } from "@/lib/usuario";
import { filasDeTotales, resumenPorMuestra } from "./resumen";

/** Las actividades con `stats` (propias o en equipo) que alguna vez estuvieron publicadas, con sus totales. */
export async function listarConEstadisticas(usuario: Pick<Usuario, "id" | "esSuperAdmin">) {
  const actividades = await prisma.culturalActivity.findMany({
    where: conPermiso({ reviewStatus: { in: ["APPROVED", "UNPUBLISHED"] } }, usuario, "stats", { listado: true }),
    select: { id: true, title: true, type: true, reviewStatus: true, startsAt: true, endsAt: true },
    orderBy: { startsAt: "desc" },
  });
  const ids = actividades.map((a) => a.id);
  if (ids.length === 0) return [];
  const [sumas, comentarios] = await Promise.all([
    prisma.culturalActivityDailyStat.groupBy({ by: ["activityId", "metric"], where: { activityId: { in: ids } }, _sum: { count: true } }),
    prisma.culturalActivityGuestbookEntry.groupBy({ by: ["activityId", "status"], where: { activityId: { in: ids } }, _count: { _all: true } }),
  ]);
  const r = resumenPorMuestra(sumas, comentarios);
  return actividades.map((a) => ({ ...a, resumen: r.get(a.id) ?? { visitas: 0, escaneos: 0, comentarios: 0, pendientes: 0 } }));
}

/** Detalle de una actividad: con `stats` (dueño, coorganización o super admin). Filas de la ventana del gráfico y totales de siempre. */
export async function estadisticasDeMuestra(id: string, usuario: Pick<Usuario, "id" | "esSuperAdmin">, ahora: Date) {
  const a = await prisma.culturalActivity.findFirst({
    where: conPermiso({ id }, usuario, "stats"),
    select: {
      id: true, slug: true, title: true, type: true, reviewStatus: true, startsAt: true, endsAt: true,
      works: { orderBy: { sortOrder: "asc" }, select: { id: true, title: true } },
    },
  });
  if (!a) return null;
  const ventana = statsWindow(a, ahora);
  const [filas, totales, comentarios] = await Promise.all([
    prisma.culturalActivityDailyStat.findMany({
      where: { activityId: a.id, day: { gte: ventana.from, lte: ventana.to } },
      select: { workId: true, day: true, metric: true, count: true },
    }),
    prisma.culturalActivityDailyStat.groupBy({ by: ["workId", "metric"], where: { activityId: a.id }, _sum: { count: true } }),
    prisma.culturalActivityGuestbookEntry.groupBy({ by: ["activityId", "status"], where: { activityId: a.id }, _count: { _all: true } }),
  ]);
  return { a, ventana, filas, totales: filasDeTotales(totales), libro: resumenPorMuestra([], comentarios).get(a.id) ?? { visitas: 0, escaneos: 0, comentarios: 0, pendientes: 0 } };
}
