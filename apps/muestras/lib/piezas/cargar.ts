import "server-only";
import { prisma } from "@repo/db";
import { distinctionsForWorks, obrasSoloOnline } from "@/lib/concursos/publico";
import { conPermiso } from "@/lib/equipo/permisos";
import type { Usuario } from "@/lib/usuario";
import type { DatosDeExpositor, MuestraParaPiezas } from "./textos";

/**
 * Una muestra con `pieces` (dueño, coorganización o super admin), de tipo muestra; publicada si se pide.
 * Etapa 7: sin las obras de un concurso marcadas "sólo online" (no van en catálogo, marcos ni plano),
 * y con el premio del concurso para el catálogo (el marco no lo lleva).
 */
export async function cargarMuestraParaPiezas(
  id: string,
  usuario: Pick<Usuario, "id" | "esSuperAdmin">,
  { publicada }: { publicada: boolean },
): Promise<MuestraParaPiezas | null> {
  const a = await prisma.culturalActivity.findFirst({
    where: conPermiso({ id, type: "MUESTRA", ...(publicada ? { reviewStatus: "APPROVED" } : {}) }, usuario, "pieces"),
    select: {
      id: true, slug: true, title: true, organizersText: true, curatorialText: true, curatorCredits: true,
      startsAt: true, endsAt: true, scheduleText: true, venueName: true, address: true, city: true, province: true,
      coverImageUrl: true, hangingPlan: true, updatedAt: true,
      works: { orderBy: { sortOrder: "asc" }, select: { id: true, title: true, authorName: true, year: true, technique: true, imageUrl: true, sortOrder: true } },
    },
  });
  if (!a) return null;
  const soloOnline = await obrasSoloOnline(a.id);
  const works = soloOnline.size ? a.works.filter((w) => !soloOnline.has(w.id)) : a.works;
  // Medidas, edición y texto de las obras de expositores (etapa 6, D38). Sin `priceArs`: el precio
  // no va en ninguna pieza.
  const ids = works.map((w) => w.id);
  const [filas, premios] = await Promise.all([prisma.culturalExhibitorWork.findMany({
    where: { activityId: a.id, activityWorkId: { in: ids } },
    select: { activityWorkId: true, imageWidthCm: true, imageHeightCm: true, edition: true, editionNumber: true, editionSize: true, statement: true },
  }), distinctionsForWorks(a.id, ids)]);
  const expositores = new Map<string, DatosDeExpositor>(filas.flatMap(({ activityWorkId, ...d }) => (activityWorkId ? [[activityWorkId, d] as const] : [])));
  return { ...a, works, expositores, premios };
}
