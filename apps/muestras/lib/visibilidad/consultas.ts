import "server-only";
import { prisma } from "@repo/db";
import { parseVisibility } from "@repo/muestras";
import { conPermiso } from "@/lib/equipo/permisos";
import type { Usuario } from "@/lib/usuario";

type Quien = Pick<Usuario, "id" | "esSuperAdmin">;

/** La muestra para la pantalla Visibilidad (`visibility`: dueño, coorganización o super admin). */
export async function cargarVisibilidad(id: string, usuario: Quien) {
  const a = await prisma.culturalActivity.findFirst({
    where: conPermiso({ id, type: "MUESTRA" }, usuario, "visibility"),
    select: {
      id: true, slug: true, title: true, reviewStatus: true, coverImageUrl: true, galleryMode: true, visibility: true, startsAt: true, endsAt: true,
      works: { orderBy: { sortOrder: "asc" }, select: { id: true, title: true, authorName: true, imageUrl: true, isHighlight: true, sortOrder: true } },
    },
  });
  if (!a) return null;
  return { muestra: a, ajuste: parseVisibility(a.visibility, a.galleryMode), tieneAjuste: a.visibility != null };
}

export { sinSemilla } from "./forma";
