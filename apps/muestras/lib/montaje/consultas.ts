import "server-only";
import { prisma } from "@repo/db";
import { parseHangingPlan } from "@repo/muestras";
import { obrasSoloOnline } from "@/lib/concursos/publico";
import { conPermiso } from "@/lib/equipo/permisos";
import type { Usuario } from "@/lib/usuario";

/**
 * La muestra con su plano ya leído, para el panel de montaje. Con `hanging` (dueño, coorganización o super admin); tipo muestra.
 *
 * Etapa 7: sin las obras de un concurso marcadas "sólo online", igual que las piezas (catálogo,
 * marcos, fichas y plano): así el panel ofrece las mismas obras y las mismas tandas que salen en
 * los PDF. `soloOnline` cuenta cuántas quedaron afuera.
 */
export async function cargarMontaje(id: string, usuario: Pick<Usuario, "id" | "esSuperAdmin">) {
  const a = await prisma.culturalActivity.findFirst({
    where: conPermiso({ id, type: "MUESTRA" }, usuario, "hanging"),
    select: {
      id: true, slug: true, title: true, reviewStatus: true, curatorialText: true, hangingPlan: true,
      works: { orderBy: { sortOrder: "asc" }, select: { id: true, title: true, authorName: true, sortOrder: true } },
    },
  });
  if (!a) return null;
  const online = await obrasSoloOnline(a.id);
  const works = online.size ? a.works.filter((w) => !online.has(w.id)) : a.works;
  const { plan } = parseHangingPlan(a.hangingPlan, works.map((w) => w.id));
  // El aviso "ya no están" cuenta sólo las obras que salieron de la muestra, no las sólo online.
  const { droppedItems } = parseHangingPlan(a.hangingPlan, a.works.map((w) => w.id));
  // La medida con marco de las obras de expositores (etapa 6, D38): el editor la propone al colgarlas.
  const marcos = await prisma.culturalExhibitorWork.findMany({
    where: { activityId: a.id, activityWorkId: { in: works.map((w) => w.id) }, frameWidthCm: { not: null }, frameHeightCm: { not: null } },
    select: { activityWorkId: true, frameWidthCm: true, frameHeightCm: true },
  });
  const porObra = new Map(marcos.map((m) => [m.activityWorkId, { widthCm: m.frameWidthCm!, heightCm: m.frameHeightCm! }]));
  return { ...a, works: works.map((w) => ({ ...w, marco: porObra.get(w.id) ?? null })), plan, droppedItems, soloOnline: a.works.length - works.length };
}
