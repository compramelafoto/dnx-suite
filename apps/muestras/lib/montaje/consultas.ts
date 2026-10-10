import "server-only";
import { prisma } from "@repo/db";
import { parseHangingPlan } from "@repo/muestras";
import { conPermiso } from "@/lib/equipo/permisos";
import type { Usuario } from "@/lib/usuario";

/** La muestra con su plano ya leído, para el panel de montaje. Con `hanging` (dueño, coorganización o super admin); tipo muestra. */
export async function cargarMontaje(id: string, usuario: Pick<Usuario, "id" | "esSuperAdmin">) {
  const a = await prisma.culturalActivity.findFirst({
    where: conPermiso({ id, type: "MUESTRA" }, usuario, "hanging"),
    select: {
      id: true, slug: true, title: true, reviewStatus: true, curatorialText: true, hangingPlan: true,
      works: { orderBy: { sortOrder: "asc" }, select: { id: true, title: true, authorName: true, sortOrder: true } },
    },
  });
  if (!a) return null;
  const { plan, droppedItems } = parseHangingPlan(a.hangingPlan, a.works.map((w) => w.id));
  return { ...a, plan, droppedItems };
}
