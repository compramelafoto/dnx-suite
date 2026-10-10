import type { StatRow } from "@repo/muestras";

export type ResumenMuestra = { visitas: number; escaneos: number; comentarios: number; pendientes: number };

/** Junta las sumas de `groupBy` por muestra. Las visitas incluyen muestra y obras; los escaneos, todos los QR. */
export function resumenPorMuestra(
  sumas: { activityId: string; metric: string; _sum: { count: number | null } }[],
  comentarios: { activityId: string; status: string; _count: { _all: number } }[],
): Map<string, ResumenMuestra> {
  const r = new Map<string, ResumenMuestra>();
  const de = (id: string) => r.get(id) ?? r.set(id, { visitas: 0, escaneos: 0, comentarios: 0, pendientes: 0 }).get(id)!;
  for (const s of sumas) {
    const fila = de(s.activityId);
    const n = s._sum.count ?? 0;
    if (s.metric === "VIEW") fila.visitas += n;
    else if (s.metric === "SCAN" || s.metric === "GUESTBOOK_SCAN") fila.escaneos += n;
  }
  for (const c of comentarios) {
    const fila = de(c.activityId);
    if (c.status === "PUBLISHED") fila.comentarios += c._count._all;
    else if (c.status === "PENDING") fila.pendientes += c._count._all;
  }
  return r;
}

export function filasDeTotales(g: { workId: string; metric: string; _sum: { count: number | null } }[]): StatRow[] {
  return g.map((x) => ({ workId: x.workId, day: "", metric: x.metric, count: x._sum.count ?? 0 }));
}
